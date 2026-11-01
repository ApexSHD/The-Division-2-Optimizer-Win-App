import type { Weapon, GearPiece, GearSlot } from "./sampleData";
import type { OptimizationSettings } from "../store";
import {
  optimizeBuilds,
  aggregateBuild,
  pruneSlotCandidates,
  evaluateBuild,
  enemyProfileFromSettings,
  type SetBonusCatalog,
  type OptimizerResult,
  type OptimizerWarning,
} from "./damage";
import { GEAR_ATTR_TYPES } from "./sampleData";
import gearJson from "../db/gear.json";
import modsJson from "../db/mod.json";
import {
  computeEffectVector,
  type AxisContext,
  type SkillChoice,
} from "./axes";
import {
  rankBuilds,
  checkAdmissibility,
  exoticAdmissible,
  roleProfile,
  allViolationsLabel,
  skillFitHint,
  GOALS,
  type MinimumViolation,
  type RoleProfile,
  type ScoredBuild,
  type AdmissibilityCheckInput,
} from "./roleProfiles";
import { SKILLS, CHC_TARGET, type AxisKey } from "./v4Data";

export type OperatingMode = "inventar" | "ziel";

export interface ModeContext {
  mode: OperatingMode;
  roleKey: string;
  skills: SkillChoice[];
  teamSize: number;
  shdLevel: number;
  settings: OptimizationSettings;
  threatStatusShare: number;
  spec: string;
  userAssumptions?: Record<string, number>;
  gearSetOptions?: {
    targetSet?: string;
    requireSetChest?: boolean;
    requireSetBackpack?: boolean;
  };
}

export interface WeaponSlot {
  slot: "primary1" | "primary2" | "pistol";
  weapon: Weapon | null;
}

export interface V4Candidate {
  id: string;
  gear: GearPiece[];
  weapon: Weapon;
  weapons: WeaponSlot[];
  vector: import("./axes").EffectVector;
  admissible: boolean;
  violations: MinimumViolation[];
  violationCount: number;
  stats: import("./damage").BuildStats;
  damage: import("./damage").DamageBreakdown;
  meetsTargetChc: boolean;
}

export interface V4BuildResult {
  mode: OperatingMode;
  role: RoleProfile;
  ranked: ScoredBuild[];
  best: ScoredBuild | null;
  candidates: V4Candidate[];
  warnings: string[];
  noAdmissibleHint: string | null;
  skillHint: string | null;
  runtimeMs: number;
}

const SLOTS: GearSlot[] = ["mask", "chest", "holster", "backpack", "gloves", "kneepads"];

const CHC_TARGET_DEFAULT = CHC_TARGET.default;
const AGGRO_SKILL_KEYS = new Set(["shield", "decoy"]);

function isSetPiece(g: GearPiece, setNameLower: string): boolean {
  if (g.brandType !== "gearset") return false;
  return g.brand.toLowerCase().includes(setNameLower);
}

function enforceGearSetRule(
  gear: GearPiece[],
  opts: { targetSet?: string; requireSetChest?: boolean; requireSetBackpack?: boolean },
): boolean {
  if (!opts.targetSet) return true;
  const setLower = opts.targetSet.toLowerCase();
  const setPieces = gear.filter((g) => isSetPiece(g, setLower));
  if (setPieces.length < 4) return false;
  if (opts.requireSetChest !== false && !setPieces.some((g) => g.slot === "chest")) return false;
  if (opts.requireSetBackpack !== false && !setPieces.some((g) => g.slot === "backpack")) return false;
  return true;
}

export function hasAggroTool(skills: SkillChoice[]): boolean {
  return skills.some((s) => AGGRO_SKILL_KEYS.has(s.skill.key));
}

export function hasHealSkill(skills: SkillChoice[]): boolean {
  return skills.some((s) => s.variant.effect_type === "heal");
}

export function hasCcSkill(skills: SkillChoice[]): boolean {
  return skills.some((s) => s.variant.effect_type === "cc");
}

function statusAttrOf(gear: GearPiece[]): number {
  return gear.reduce(
    (sum, g) =>
      sum + g.attributes.filter((a) => a.type === "status").reduce((s, a) => s + a.value, 0),
    0,
  );
}

export interface GearModPick {
  slot: GearSlot;
  attr: string;
  val: number;
}

const GEAR_MOD_SLOTS: GearSlot[] = ["mask", "chest", "backpack"];

interface GearModDef {
  attr: string;
  name: string;
  val: number;
  unit: string;
}

const GEAR_MODS_BY_ROLE_PRIORITY: Record<string, string[]> = {
  dps_krit: ["chc", "chd", "hsd"],
  dps_kopf: ["hsd", "chd", "chc"],
  skill_heiler: ["repair", "skillhaste", "skillduration"],
  skill_schaden: ["skillhaste", "skillduration", "repair"],
  kontrolle: ["skillhaste", "skillduration", "repair"],
  ruestungs_supporter: ["repair", "hazard", "skillhaste"],
  tank: ["hazard", "pfe", "aok"],
  buffer: ["skillhaste", "repair", "chc"],
  hybrid_schaden_skill: ["chc", "skillhaste", "chd"],
  hybrid_schaden_tank: ["chc", "hazard", "chd"],
  hybrid_skill_tank: ["skillhaste", "hazard", "repair"],
};

function gearModCatalog(): GearModDef[] {
  const db = modsJson as unknown as {
    gear_mods?: Record<string, Array<{ attr: string; name: string; val: number; unit: string }>>;
  };
  const out: GearModDef[] = [];
  for (const list of Object.values(db.gear_mods ?? {})) {
    for (const m of list) out.push({ attr: m.attr, name: m.name, val: m.val, unit: m.unit });
  }
  return out;
}

export function bestGearModsForRole(
  roleKey: string,
  opts: { chcTarget?: number; chcCurrent?: number } = {},
): GearModPick[] {
  const priority = GEAR_MODS_BY_ROLE_PRIORITY[roleKey] ?? ["chc", "chd", "hsd"];
  let list = priority;
  if (opts.chcTarget !== undefined && opts.chcCurrent !== undefined) {
    const capped = Math.min(60, opts.chcCurrent);
    if (capped >= opts.chcTarget) {
      list = priority.map((a) => (a === "chc" ? "chd" : a));
    }
  }
  const catalog = gearModCatalog();
  const picks: GearModPick[] = [];
  for (const slot of GEAR_MOD_SLOTS) {
    let best: GearModDef | null = null;
    let bestRank = Infinity;
    for (const mod of catalog) {
      const rank = list.indexOf(mod.attr);
      if (rank === -1) continue;
      if (rank < bestRank) {
        bestRank = rank;
        best = mod;
      }
    }
    if (best) {
      picks.push({ slot, attr: best.attr, val: best.val });
    }
  }
  return picks;
}

function modAttrTotal(picks: GearModPick[], attr: string): number {
  return picks.filter((p) => p.attr === attr).reduce((s, p) => s + p.val, 0);
}

export function axisContextFor(
  gear: GearPiece[],
  weaponDps: number,
  ctx: ModeContext,
  role: RoleProfile,
): AxisContext {
  const chcBase = aggregateBuild(gear, ctx.shdLevel).chc;
  const chcTarget = role.chcTarget ?? CHC_TARGET_DEFAULT;
  const gearMods = bestGearModsForRole(role.key, {
    chcTarget,
    chcCurrent: chcBase,
  });
  const gearWithMods: GearPiece[] = gear.map((g) => {
    const pick = gearMods.find((p) => p.slot === g.slot);
    if (!pick) return g;
    return {
      ...g,
      attributes: [
        ...g.attributes,
        { type: pick.attr as never, value: pick.val },
      ],
    };
  });
  return {
    weaponDps,
    gear: gearWithMods,
    skills: ctx.skills,
    sklKind: role.sklKind,
    teamSize: ctx.teamSize,
    threat: { statusShare: ctx.threatStatusShare },
    specializationKey: ctx.spec || undefined,
    userAssumptions: ctx.userAssumptions,
  };
}

function admissibilityInput(
  gear: GearPiece[],
  vector: import("./axes").EffectVector,
  role: RoleProfile,
  ctx: ModeContext,
): AdmissibilityCheckInput {
  const chcBase = aggregateBuild(gear, ctx.shdLevel).chc;
  const gearMods = bestGearModsForRole(role.key, {
    chcTarget: role.chcTarget ?? CHC_TARGET_DEFAULT,
    chcCurrent: chcBase,
  });
  const gearWithMods: GearPiece[] = gear.map((g) => {
    const pick = gearMods.find((p) => p.slot === g.slot);
    if (!pick) return g;
    return {
      ...g,
      attributes: [...g.attributes, { type: pick.attr as never, value: pick.val }],
    };
  });
  const chcWithMods = chcBase + modAttrTotal(gearMods, "chc");
  return {
    gear: gearWithMods,
    vector,
    role,
    chc: chcWithMods,
    headshotShare: Math.max(0, Math.min(100, ctx.settings.enemyHeadshotShare)) / 100,
    statusAttr: statusAttrOf(gear),
    hasHealSkill: hasHealSkill(ctx.skills),
    hasCcSkill: hasCcSkill(ctx.skills),
    hasAggroTool: hasAggroTool(ctx.skills),
    hasTeamArmorSource: false,
    hasTeamBuffSource: false,
  };
}

export function buildCandidatesFromOptimizer(
  optimizerResults: import("./damage").OptimizerResult[],
  ctx: ModeContext,
  role: RoleProfile,
): V4Candidate[] {
  const out: V4Candidate[] = [];
  for (const r of optimizerResults) {
    const vector = computeEffectVector(
      axisContextFor(
        r.gear,
        ctx.settings.targetMetric === "burst" ? r.damage.effectiveDps : r.damage.sustainedDps,
        ctx,
        role,
      ),
    );
    const statsWithGearMods = applyWeaponAttrsToStats(
      applyGearModsToStats(r.stats, ctx, role),
      r.weapon,
    );
    const setRuleOk = enforceGearSetRule(r.gear, ctx.gearSetOptions ?? {});
    const adm = !setRuleOk
      ? { admissible: false, violations: [{ kind: "team_buff_source" as const, label: "Gearset-Regel: 4 Set-Teile bzw. Set-Weste/-Rucksack fehlen", actual: null, required: null }] }
      : exoticAdmissible(r.gear)
        ? checkAdmissibility(admissibilityInput(r.gear, vector, role, ctx))
        : { admissible: false, violations: [{ kind: "team_buff_source" as const, label: "Exotic-Limit: höchstens ein exotisches Ausrüstungsteil", actual: null, required: null }] };
    out.push({
      id: [...r.gear.map((g) => g.id)].sort().join("|") + "::" + r.weapon.id + weaponSlotsSuffix(r.weapons),
      gear: r.gear,
      weapon: r.weapon,
      weapons: r.weapons,
      vector,
      admissible: adm.admissible,
      violations: adm.violations,
      violationCount: adm.violations.length,
      stats: statsWithGearMods,
      damage: r.damage,
      meetsTargetChc: r.meetsTargetChc,
    });
  }
  return out;
}

export function goalForRole(roleKey: string): string {
  const role = roleProfile(roleKey);
  return GOALS.find((g) => g.key === role.ziel)?.name ?? GOALS[0].name;
}

export function reduceSearchSpace(
  gear: GearPiece[],
  role: RoleProfile,
  budgetPerSlot = 12,
): { gear: GearPiece[]; pruned: number } {
  const bySlot = new Map<GearSlot, GearPiece[]>();
  for (const slot of SLOTS) bySlot.set(slot, []);
  for (const g of gear) bySlot.get(g.slot)?.push(g);

  const pruned = { count: 0 };
  const kept: GearPiece[] = [];
  for (const slot of SLOTS) {
    const items = bySlot.get(slot)!;
    const scored = items.map((g) => {
      const v = computeEffectVector(
        axisContextFor([g], 1_000_000, {
          mode: "inventar",
          roleKey: role.key,
          skills: [],
          teamSize: 4,
          shdLevel: 0,
          settings: {} as OptimizationSettings,
          threatStatusShare: 0.3,
          spec: "",
        } as ModeContext, role),
      );
      let fit = 0;
      for (const axis of ["dps", "skl", "ehp", "cc", "buf", "upt"] as AxisKey[]) {
        fit += role.weights[axis] * (v as unknown as Record<AxisKey, number>)[axis];
      }
      return { g, fit };
    });
    scored.sort((a, b) => b.fit - a.fit || (a.g.id < b.g.id ? -1 : 1));
    const take = scored.slice(0, budgetPerSlot);
    pruned.count += items.length - take.length;
    kept.push(...take.map((s) => s.g));
  }
  return { gear: kept, pruned: pruned.count };
}

export interface WeaponSlotPick {
  slot: "primary1" | "primary2" | "pistol";
  weapon: Weapon | null;
}

function weaponSlotsSuffix(slots: WeaponSlotPick[]): string {
  const parts = slots.filter((x) => x.weapon).map((x) => `${x.slot}:${x.weapon!.id}`);
  return parts.length > 0 ? ":" + parts.join(",") : "";
}

function isExoticWeapon(w: Weapon): boolean {
  return w.rarity === "exotic";
}

/**
 * Baut die Waffen-Slots für einen Kandidaten: 2 Primärwaffen (bestes Paar nach
 * Zielmetrik, Exotic-Waffenlimit ≤ 1) plus optional 1 Pistole. Rotation-Metrik:
 * gewichteter Mix beider Primärwaffen (50/50 je Slot, konfigurierbar über
 * settings.userAssumptions). Ohne Pistole im Pool bleibt der Slot null.
 */
export function buildWeaponSlots(
  poolWeapons: Weapon[],
  targetMetric: "burst" | "sustained" | "rotation",
  profile: import("./damage").EnemyProfile,
  shdLevel: number,
  spec: string,
  setBonusCatalog?: unknown,
  modsBySlot?: unknown,
): WeaponSlotPick[] {
  const metricOf = (w: Weapon) => {
    const { damage } = evaluateBuild(w, [], {
      shdLevel,
      profile,
      spec,
      modsBySlot: modsBySlot as never,
      setBonusCatalog: setBonusCatalog as never,
    });
    return targetMetric === "burst" ? damage.effectiveDps : damage.sustainedDps;
  };
  const ranked = [...poolWeapons].sort((a, b) => metricOf(b) - metricOf(a));
  const primaries: Weapon[] = [];
  for (const w of ranked) {
    if (primaries.length >= 2) break;
    if (isExoticWeapon(w) && primaries.some(isExoticWeapon)) continue;
    if (primaries.some((p) => p.id === w.id)) continue;
    primaries.push(w);
  }
  const pistol = ranked.find((w) => w.type === "pistol" && !primaries.some((p) => p.id === w.id)) ?? null;
  return [
    { slot: "primary1", weapon: primaries[0] ?? null },
    { slot: "primary2", weapon: primaries[1] ?? null },
    { slot: "pistol", weapon: pistol },
  ];
}

/**
 * Kombinierte Schadensmetrik eines Waffen-Slots: bei Rotation zählt der Mix aus
 * beiden Primärwaffen (je 50 % Anteil), sonst die führende Waffe (primary1).
 */
export function combinedWeaponDps(
  slots: WeaponSlotPick[],
  targetMetric: "burst" | "sustained" | "rotation",
  profile: import("./damage").EnemyProfile,
  shdLevel: number,
  spec: string,
  setBonusCatalog?: unknown,
  modsBySlot?: unknown,
): number {
  const dpsOf = (w: Weapon | null) => {
    if (!w) return 0;
    const { damage } = evaluateBuild(w, [], {
      shdLevel,
      profile,
      spec,
      modsBySlot: modsBySlot as never,
      setBonusCatalog: setBonusCatalog as never,
    });
    return targetMetric === "burst" ? damage.effectiveDps : damage.sustainedDps;
  };
  const p1 = slots.find((x) => x.slot === "primary1")?.weapon ?? null;
  const p2 = slots.find((x) => x.slot === "primary2")?.weapon ?? null;
  if (targetMetric === "rotation") {
    return dpsOf(p1) * 0.5 + dpsOf(p2) * 0.5;
  }
  return dpsOf(p1 ?? p2);
}

export const DEFAULT_BEAM_WIDTH = 2000;
export const DEFAULT_SLOT_BUDGET = 25;

/**
 * Beam-Suche über die Slots: statt kartesischem Produkt (25^6 ≈ 244 Mio.) werden
 * pro Slot-Stufe nur die besten BEAM_WIDTH Partial-Kombinationen weitergeführt.
 * Specials (Named/Exotic/Set/Talent) und Locks bleiben über pruneSlotCandidates
 * geschützt; Dominanz-Filter entfernt strikt schlechtere Teile vorab.
 * Liefert dieselbe Kandidaten-Schnittstelle wie cartesianBySlot, aber skalierbar.
 */
export function beamCombosBySlot(
  bySlot: Map<GearSlot, GearPiece[]>,
  lockedGear: GearPiece[] = [],
  opts: { beamWidth?: number; slotBudget?: number; score?: (combo: GearPiece[]) => number; onProgress?: (doneSlots: number, totalSlots: number) => void; shouldAbort?: () => boolean; exoticCap?: number } = {},
): { combos: GearPiece[][]; warnings: string[] } {
  const beamWidth = opts.beamWidth ?? DEFAULT_BEAM_WIDTH;
  const slotBudget = opts.slotBudget ?? DEFAULT_SLOT_BUDGET;
  const warnings: string[] = [];
  const lockedIds = new Set(lockedGear.map((g) => g.id));

  const slots = SLOTS.filter((s) => (bySlot.get(s) ?? []).length > 0);
  const gearsetSlots = new Set<GearSlot>();
  for (const [slot, items] of bySlot) {
    if (items.some((g) => g.brandType === "gearset")) gearsetSlots.add(slot);
  }
  const slotLists: GearPiece[][] = [];
  for (const slot of slots) {
    const items = [...(bySlot.get(slot) ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1));
    let pool = items;
    if (items.length > slotBudget) {
      const pruned = pruneSlotCandidates(items, lockedGear);
      if (pruned.length < items.length) {
        warnings.push(`Slot ${slot}: ${items.length} Teile auf ${pruned.length} Kandidaten reduziert (Dominanz-Filter + Top-${slotBudget}).`);
        pool = pruned;
      }
      if (pool.length > slotBudget) {
        const scored = pool.map((g) => {
          let sum = 0;
          if (g.core === "wd") sum += (g.coreValue / (GEAR_ATTR_TYPES.wd?.max ?? 15)) * 10;
          for (const a of g.attributes) {
            const max = GEAR_ATTR_TYPES[a.type]?.max ?? 0;
            if (max > 0) sum += (a.value / max) * 10;
          }
          return { g, sum };
        });
        scored.sort((a, b) => b.sum - a.sum || (a.g.id < b.g.id ? -1 : 1));
        const specials = pool.filter((g) => lockedIds.has(g.id) || g.brandType !== "brand" || g.talent);
        const budget = Math.max(0, slotBudget - specials.length);
        pool = [...specials, ...scored.filter((x) => !specials.includes(x.g)).slice(0, budget).map((x) => x.g)];
        warnings.push(`Slot ${slot}: ${items.length} Teile auf ${pool.length} Kandidaten begrenzt (Top-${slotBudget} nach normalisiertem Beitrag).`);
      }
    }
    slotLists.push(pool);
  }

  const lockedInBeam = lockedGear.filter((g) => (bySlot.get(g.slot) ?? []).some((x) => x.id === g.id));
  const lockedSlots = new Set(lockedInBeam.map((g) => g.slot));
  const freeSlots = slots.filter((s) => !lockedSlots.has(s));
  const slotListsFree = slotLists.filter((_, i) => !lockedSlots.has(slots[i]));
  let beam: { combo: GearPiece[]; sc: number }[] = [
    ...(lockedInBeam.length > 0 ? [{ combo: lockedInBeam, sc: 0 }] : [{ combo: [], sc: 0 }]),
  ];
  for (let si = 0; si < slotListsFree.length; si++) {
    const slot = freeSlots[si];
    if (opts.shouldAbort?.()) {
      warnings.push("Abgebrochen – Teilergebnis (Beam-Suche).");
      break;
    }
    const next: { combo: GearPiece[]; sc: number }[] = [];
    const exoticCap = opts.exoticCap ?? Infinity;
    for (const partial of beam) {
      const partialStats = aggregateBuild(partial.combo, 0);
      const partialExotics = partial.combo.filter((g) => g.brandType === "exotic").length;
      for (const item of slotListsFree[si]) {
        if (item.brandType === "exotic" && partialExotics + 1 > exoticCap) continue;
        if (partial.combo.some((g) => g.slot === item.slot)) continue;
        const combo = [...partial.combo, item];
        const st = aggregateBuild([item], 0);
        const merged = {
          wd: partialStats.wd + st.wd,
          chc: partialStats.chc + st.chc,
          chd: partialStats.chd + st.chd,
          hsd: partialStats.hsd + st.hsd,
          dta: partialStats.dta + st.dta,
          dth: partialStats.dth + st.dth,
          dttooc: partialStats.dttooc + st.dttooc,
        };
        const setBrands = new Map<string, number>();
        const brandCounts = new Map<string, number>();
        for (const g of combo) {
          if (g.brandType === "gearset") setBrands.set(g.brand, (setBrands.get(g.brand) ?? 0) + 1);
          if (g.brandType === "brand") brandCounts.set(g.brand, (brandCounts.get(g.brand) ?? 0) + 1);
        }
        let setMult = 1;
        for (const c of setBrands.values()) {
          if (c >= 6) setMult = Math.max(setMult, 64);
          else if (c >= 4) setMult = Math.max(setMult, 16);
          else if (c >= 3) setMult = Math.max(setMult, 4);
          else if (c >= 2) setMult = Math.max(setMult, 2);
        }
        let brandMult = 1;
        for (const c of brandCounts.values()) if (c >= 2) brandMult = Math.max(brandMult, 1.5);
        if (combo.some((g) => g.brandType === "exotic")) brandMult *= 1.3;
        if (combo.some((g) => g.talent)) brandMult *= 1.4;
        const chcPieceBonus = merged.chc >= 40 ? 30000 : merged.chc >= 30 ? 15000 : 0;
        const base = merged.wd * 3 + merged.chc * 2 + merged.chd * 2 + merged.hsd + merged.dta + merged.dth + merged.dttooc;
        next.push({ combo, sc: base * setMult * brandMult + chcPieceBonus });
      }
    }
    next.sort((a, b) => b.sc - a.sc || (a.combo.map((g) => g.id).join("|") < b.combo.map((g) => g.id).join("|") ? -1 : 1));
    beam = next.slice(0, beamWidth);
    if (lockedInBeam.length > 0) {
      const withLocks = beam.map((b) => {
        const missing = lockedInBeam.filter((g) => !b.combo.some((x) => x.id === g.id));
        return missing.length > 0 ? { combo: [...b.combo, ...missing], sc: b.sc } : b;
      });
      beam = withLocks;
    }
    if (gearsetSlots.has(slot)) {
      const setItems = slotListsFree[si].filter((g) => g.brandType === "gearset");
      const forced: { combo: GearPiece[]; sc: number }[] = [];
      for (const partial of beam) {
        for (const item of setItems) {
          if (partial.combo.some((g) => g.slot === item.slot)) continue;
          const combo = [...partial.combo, item];
          const st = aggregateBuild(combo, 0);
          const setBrands2 = new Map<string, number>();
          for (const g of combo) if (g.brandType === "gearset") setBrands2.set(g.brand, (setBrands2.get(g.brand) ?? 0) + 1);
          let syn = 1;
          for (const c of setBrands2.values()) {
            if (c >= 6) syn = Math.max(syn, 64);
            else if (c >= 4) syn = Math.max(syn, 16);
            else if (c >= 3) syn = Math.max(syn, 4);
            else if (c >= 2) syn = Math.max(syn, 2);
          }
          forced.push({ combo, sc: (st.wd * 3 + st.chc * 2 + st.chd * 2 + st.hsd + st.dta + st.dth + st.dttooc) * syn });
        }
      }
      if (forced.length > 0) {
        const seenCombo = new Set(beam.map((b) => b.combo.map((g) => g.id).sort().join("|")));
        const add = forced.filter((f) => !seenCombo.has(f.combo.map((g) => g.id).sort().join("|")));
        beam = [...beam, ...add].sort((a, b) => b.sc - a.sc).slice(0, beamWidth * 2);
      }
    }
    opts.onProgress?.(si + 1, slotListsFree.length);
  }
  const lockedIdsFinal = new Set(lockedInBeam.map((g) => g.id));
  const combos = beam.map((b) => {
    const missing = lockedInBeam.filter((g) => !b.combo.some((x) => x.id === g.id));
    return missing.length > 0 ? [...b.combo, ...missing] : b.combo;
  });
  void lockedIdsFinal;
  return { combos, warnings };
}

export function optimizeV4(
  weapons: Weapon[],
  gear: GearPiece[],
  ctx: ModeContext,
  opts: {
    setBonusCatalog?: unknown;
    modsBySlot?: Record<string, { name: string; slotTypes: string[]; bonus: { type: string; val: number } | null; penalty?: { type: string; val: number } | null }[]>;
    maxResults?: number;
    budgetPerSlot?: number;
    beamWidth?: number;
    useBeam?: boolean;
    onProgress?: (phase: string, done: number, total: number) => void;
    shouldAbort?: () => boolean;
  } = {},
): V4BuildResult {
  const start = Date.now();
  const role = roleProfile(ctx.roleKey);
  const warnings: string[] = [];

  const useBeam = opts.useBeam ?? true;
  const excludedGear = new Set(ctx.settings.excludedGearIds ?? []);
  const excludedWeapons = new Set(ctx.settings.excludedWeaponIds ?? []);
  const poolWeapons = weapons.filter((w) => !excludedWeapons.has(w.id));
  let candidateGear = gear.filter((g) => !excludedGear.has(g.id));
  if (candidateGear.length < gear.length) {
    warnings.push(`Ausschluss aktiv: ${gear.length - candidateGear.length} Gear-Teil(e) vor der Suche entfernt.`);
  }
  if (poolWeapons.length < weapons.length) {
    warnings.push(`Ausschluss aktiv: ${weapons.length - poolWeapons.length} Waffe(n) vor der Suche entfernt.`);
  }
  if (ctx.mode === "ziel" && !useBeam) {
    const reduced = reduceSearchSpace(gear, role, opts.budgetPerSlot ?? 12);
    candidateGear = reduced.gear;
    if (reduced.pruned > 0) {
      warnings.push(
        `Ziel-Build: Suchraum reduziert — ${reduced.pruned} aussichtslose Teile pro Slot-Ranking entfernt (Budget ${opts.budgetPerSlot ?? 12} je Slot).`,
      );
    }
  }
  if (useBeam && opts.shouldAbort?.()) {
    return { mode: ctx.mode, role, ranked: [], best: null, candidates: [], warnings: ["Abgebrochen."], noAdmissibleHint: null, skillHint: null, runtimeMs: Date.now() - start };
  }

  let optimizerResults: OptimizerResult[];
  if (useBeam) {
    const bySlot = new Map<GearSlot, GearPiece[]>();
    for (const slot of SLOTS) bySlot.set(slot, []);
    for (const g of candidateGear) bySlot.get(g.slot)?.push(g);
    const lockedGear = candidateGear.filter((g) => ctx.settings.lockedGearIds.includes(g.id));
    const setBonusCatalog = (opts.setBonusCatalog as never) ?? defaultSetBonusCatalog();
    const profile = enemyProfileFromSettings(ctx.settings);
    const chcTarget = role.chcTarget ?? ctx.settings.targetChc;
    const anchorWeapon = poolWeapons.find((w) => w.id === ctx.settings.anchorWeaponId) ?? null;
    let candidateWeapons = anchorWeapon ? [anchorWeapon] : poolWeapons;
    if (!anchorWeapon && ctx.settings.weaponTypeFilter) {
      const filtered = candidateWeapons.filter((w) => w.type === ctx.settings.weaponTypeFilter);
      if (filtered.length > 0) candidateWeapons = filtered;
    }
    const slotLens = SLOTS.map((slot) => Math.max(1, Math.min(bySlot.get(slot)?.length ?? 1, opts.budgetPerSlot ?? DEFAULT_SLOT_BUDGET)));
    const totalCombosEstimate = slotLens.reduce((acc, n) => acc * n, 1);
    const beamWidth = opts.beamWidth ?? Math.min(totalCombosEstimate, ctx.mode === "ziel" ? 8000 : DEFAULT_BEAM_WIDTH);
    const beam = beamCombosBySlot(bySlot, lockedGear, {
      beamWidth,
      slotBudget: opts.budgetPerSlot ?? DEFAULT_SLOT_BUDGET,
      exoticCap: 1,
      onProgress: (done, total) => opts.onProgress?.("beam", done, total),
      shouldAbort: opts.shouldAbort,
    });
    warnings.push(...beam.warnings);
    if (ctx.mode === "ziel" && beam.warnings.length > 0) {
      warnings.push(`Ziel-Build: Suchraum per Beam/Pruning reduziert (Budget ${opts.budgetPerSlot ?? DEFAULT_SLOT_BUDGET} je Slot, Beam ${opts.beamWidth ?? DEFAULT_BEAM_WIDTH}).`);
    }
    const combos = beam.combos;
    let evaluated = 0;
    optimizerResults = [];
    const seen = new Set<string>();
    const weaponDpsCache = new Map<string, number>();
    for (const w of candidateWeapons) {
      const { damage } = evaluateBuild(w, combos[0] ?? [], {
        shdLevel: ctx.shdLevel,
        profile,
        spec: ctx.spec,
        modsBySlot: opts.modsBySlot as never,
        setBonusCatalog: setBonusCatalog as never,
      });
      weaponDpsCache.set(w.id, ctx.settings.targetMetric === "burst" ? damage.effectiveDps : damage.sustainedDps);
    }
    const sortedWeapons = [...candidateWeapons].sort((a, b) => (weaponDpsCache.get(b.id) ?? 0) - (weaponDpsCache.get(a.id) ?? 0));
    const weaponSlots = buildWeaponSlots(sortedWeapons, ctx.settings.targetMetric, profile, ctx.shdLevel, ctx.spec, setBonusCatalog, opts.modsBySlot);
    const leadWeapon = weaponSlots.find((x) => x.slot === "primary1")?.weapon ?? sortedWeapons[0] ?? null;
    const comboWeaponDps = combinedWeaponDps(weaponSlots, ctx.settings.targetMetric, profile, ctx.shdLevel, ctx.spec, setBonusCatalog, opts.modsBySlot);
    opts.onProgress?.("evaluate", 0, combos.length);
    for (const combo of combos) {
      if (opts.shouldAbort?.()) {
        warnings.push("Abgebrochen – Teilergebnis (Beam-Suche).");
        break;
      }
      const exoticGear = combo.filter((g) => g.brandType === "exotic").length;
      if (exoticGear > 1) continue;
      if (combo.length < SLOTS.length) continue;
      for (const w of [leadWeapon]) {
        if (!w) continue;
        const key = combo.map((g) => g.id).join("|") + "::" + w.id + weaponSlotsSuffix(weaponSlots);
        if (seen.has(key)) continue;
        seen.add(key);
        const { stats, damage } = evaluateBuild(w, combo, {
          shdLevel: ctx.shdLevel,
          profile,
          spec: ctx.spec,
          modsBySlot: opts.modsBySlot as never,
          setBonusCatalog: setBonusCatalog as never,
        });
        const meetsTargetChc = damage.cappedChc >= chcTarget;
        optimizerResults.push({
          rank: 0,
          weapon: w,
          weapons: weaponSlots,
          gear: combo,
          stats,
          damage,
          meetsTargetChc,
          gearSetCount: 0,
          reason: meetsTargetChc ? `CHC-Ziel ${chcTarget} % erreicht (${damage.cappedChc} %)` : `CHC ${damage.cappedChc} % unter Ziel ${chcTarget} %`,
          reasonParts: [],
          slotExplanations: [],
          warnings: [] as OptimizerWarning[],
          roleScore: { key: "" as const, score: comboWeaponDps, label: ctx.settings.targetMetric === "rotation" ? "Rotation-DPS" : "Waffen-DPS" },
          assumptions: { items: [], wastedChc: 0, overTargetChc: 0 },
        });
        evaluated++;
        if (evaluated % 500 === 0) opts.onProgress?.("evaluate", evaluated, combos.length);
      }
    }
    const keep = Math.max(opts.maxResults ?? 50, 200);
    const metric = (r: OptimizerResult) =>
      ctx.settings.targetMetric === "burst"
        ? r.damage.effectiveDps
        : ctx.settings.targetMetric === "rotation"
          ? r.roleScore.score
          : r.damage.sustainedDps;
    const pre: OptimizerResult[] = [];
    for (const r of optimizerResults) {
      if (pre.length >= keep * 4) break;
      if (r.meetsTargetChc || pre.length < keep) pre.push(r);
    }
    optimizerResults = pre;
    optimizerResults.sort((a, b) => {
      if (a.meetsTargetChc !== b.meetsTargetChc) return a.meetsTargetChc ? -1 : 1;
      const dpsDiff = metric(b) - metric(a);
      if (Math.abs(dpsDiff) > 1e-9) return dpsDiff;
      return a.gear.map((g) => g.id).join("|") < b.gear.map((g) => g.id).join("|") ? -1 : 1;
    });
    const gearDiffCount = (a: OptimizerResult, b: OptimizerResult) => {
      const bySlotA = new Map(a.gear.map((g) => [g.slot, g.id]));
      let diff = 0;
      for (const g of b.gear) {
        if (bySlotA.get(g.slot) !== g.id) diff++;
      }
      return diff;
    };
    const diverse: OptimizerResult[] = [];
    for (const r of optimizerResults) {
      if (diverse.length >= keep) break;
      if (diverse.every((t) => gearDiffCount(t, r) >= 2)) diverse.push(r);
    }
    if (diverse.length < keep) {
      const seen = new Set(diverse.map((r) => r.gear.map((g) => g.id).join("|") + "::" + r.weapon.id + weaponSlotsSuffix(r.weapons)));
      for (const r of optimizerResults) {
        if (diverse.length >= keep) break;
        const key = r.gear.map((g) => g.id).join("|") + "::" + r.weapon.id + weaponSlotsSuffix(r.weapons);
        if (seen.has(key)) continue;
        seen.add(key);
        diverse.push(r);
      }
    }
    optimizerResults = diverse;

    optimizerResults.forEach((r, i) => {
      r.rank = i + 1;
    });
  } else {
    optimizerResults = optimizeBuilds(
      poolWeapons,
      candidateGear,
      ctx.shdLevel,
      ctx.settings,
      {
        maxResults: opts.maxResults ?? 50,
        spec: ctx.spec,
        considerMods: true,
        modsBySlot: opts.modsBySlot as never,
        setBonusCatalog: (opts.setBonusCatalog as never) ?? defaultSetBonusCatalog(),
      },
    );
  }

  const candidates = buildCandidatesFromOptimizer(optimizerResults, ctx, role);
  const chcTarget = role.chcTarget ?? ctx.settings.targetChc;
  const ranking = rankBuilds(
    role,
    candidates.map((c) => ({
      id: c.id,
      vector: c.vector,
      admissible: c.admissible,
      violations: c.violations,
      violationCount: c.violationCount,
      meetsTargetChc: c.damage.cappedChc >= chcTarget,
    })),
  );

  const best = ranking.bestAdmissible;
  const noAdmissibleHint = best ? null : allViolationsLabel(ranking);
  const skillHint = skillFitHint(
    role,
    hasHealSkill(ctx.skills),
    hasCcSkill(ctx.skills),
  );

  return {
    mode: ctx.mode,
    role,
    ranked: ranking.ranked,
    best,
    candidates,
    warnings,
    noAdmissibleHint,
    skillHint,
    runtimeMs: Date.now() - start,
  };
}

function applyGearModsToStats(
  stats: import("./damage").BuildStats,
  _ctx: ModeContext,
  role: RoleProfile,
): import("./damage").BuildStats {
  const gearMods = bestGearModsForRole(role.key, {
    chcTarget: role.chcTarget ?? CHC_TARGET_DEFAULT,
    chcCurrent: stats.chc,
  });
  if (gearMods.length === 0) return stats;
  const next: import("./damage").BuildStats = {
    ...stats,
    sources: Object.fromEntries(
      Object.entries(stats.sources).map(([k, v]) => [k, [...v]]),
    ),
  };
  const attrMap: Record<string, keyof import("./damage").BuildStats> = {
    chc: "chc",
    chd: "chd",
    hsd: "hsd",
    hazard: "dta",
  };
  for (const pick of gearMods) {
    const key = attrMap[pick.attr];
    if (!key) continue;
    (next[key] as number) += pick.val;
    (next.sources[pick.attr] ??= []).push({
      itemId: `gear-mod-${pick.slot}`,
      label: `Gear-Mod (${SLOT_LABEL_GEAR_MODS[pick.slot] ?? pick.slot})`,
      value: pick.val,
    });
  }
  return next;
}

const SLOT_LABEL_GEAR_MODS: Record<string, string> = {
  mask: "Maske",
  chest: "Weste",
  backpack: "Rucksack",
};

function applyWeaponAttrsToStats(
  stats: import("./damage").BuildStats,
  weapon: Weapon,
): import("./damage").BuildStats {
  const next: import("./damage").BuildStats = {
    ...stats,
    sources: Object.fromEntries(
      Object.entries(stats.sources).map(([k, v]) => [k, [...v]]),
    ),
  };
  const wa = weapon.attributes;
  const push = (attr: string, label: string, value: number) => {
    if (value === 0) return;
    const key = attr as keyof import("./damage").BuildStats;
    (next[key] as number) += value;
    (next.sources[attr] ??= []).push({ itemId: weapon.id, label, value });
  };
  push("wd", "Waffe — Kern", wa.core1);
  const attrLabels: Record<string, string> = {
    chc: "chc",
    chd: "chd",
    hsd: "hsd",
    dth: "dth",
    dta: "dta",
    dttooc: "dttooc",
    rof: "rof",
  };
  if (attrLabels[wa.core2Type]) {
    push(attrLabels[wa.core2Type], "Waffe — Attribut 2", wa.core2Val);
  }
  if (attrLabels[wa.minorType]) {
    push(attrLabels[wa.minorType], "Waffe — Attribut 3", wa.minorVal);
  }
  if (weapon.innateHsd) {
    push("hsd", "Waffe — angeborener Kopfschuss", weapon.innateHsd);
  }
  return next;
}

export function defaultSetBonusCatalog(): SetBonusCatalog {
  const gearDb = gearJson as unknown as {
    brand_set_info: Record<string, Record<string, unknown>>;
    green_set_info: Record<string, Record<string, unknown>>;
  };
  const brands: SetBonusCatalog["brands"] = {};
  for (const [key, info] of Object.entries(gearDb.brand_set_info ?? {})) {
    brands[key.toLowerCase()] = (info as { bonuses_pve?: Record<string, Record<string, unknown>> }).bonuses_pve ?? {};
  }
  const greens: SetBonusCatalog["greens"] = {};
  for (const [key, info] of Object.entries(gearDb.green_set_info ?? {})) {
    greens[key.toLowerCase()] = (info as { bonuses?: Record<string, { attr: string; val: number }[]> }).bonuses ?? {};
  }
  return { brands, greens };
}

export function reachability(
  inventar: V4BuildResult,
  ziel: V4BuildResult,
): ReachabilityResult {
  const inventarScore = inventar.best?.score ?? null;
  const zielScore = ziel.best?.score ?? null;
  let reachabilityPercent: number | null = null;
  if (inventarScore !== null && zielScore !== null && zielScore > 0) {
    reachabilityPercent = (100 * inventarScore) / zielScore;
  }
  return {
    mode: "ziel",
    inventarScore,
    zielScore,
    reachabilityPercent,
    targetIsUpperBound: zielScore === null || inventarScore === null
      ? true
      : zielScore >= inventarScore,
  };
}

export interface ReachabilityResult {
  mode: OperatingMode;
  inventarScore: number | null;
  zielScore: number | null;
  reachabilityPercent: number | null;
  targetIsUpperBound: boolean;
}

export const V4_ALL_SLOTS = SLOTS;
export { SKILLS };
