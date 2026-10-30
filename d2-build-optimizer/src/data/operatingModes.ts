import type { Weapon, GearPiece, GearSlot } from "./sampleData";
import type { OptimizationSettings } from "../store";
import { optimizeBuilds, aggregateBuild, type SetBonusCatalog } from "./damage";
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
import { SKILLS, type AxisKey } from "./v4Data";

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
}

export interface V4Candidate {
  id: string;
  gear: GearPiece[];
  weapon: Weapon;
  vector: import("./axes").EffectVector;
  admissible: boolean;
  violations: MinimumViolation[];
  violationCount: number;
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

const AGGRO_SKILL_KEYS = new Set(["shield", "decoy"]);

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

export function bestGearModsForRole(roleKey: string): GearModPick[] {
  const priority = GEAR_MODS_BY_ROLE_PRIORITY[roleKey] ?? ["chc", "chd", "hsd"];
  const catalog = gearModCatalog();
  const picks: GearModPick[] = [];
  for (const slot of GEAR_MOD_SLOTS) {
    let best: GearModDef | null = null;
    let bestRank = Infinity;
    for (const mod of catalog) {
      const rank = priority.indexOf(mod.attr);
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
  const gearMods = bestGearModsForRole(role.key);
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
  const gearMods = bestGearModsForRole(role.key);
  const gearWithMods: GearPiece[] = gear.map((g) => {
    const pick = gearMods.find((p) => p.slot === g.slot);
    if (!pick) return g;
    return {
      ...g,
      attributes: [...g.attributes, { type: pick.attr as never, value: pick.val }],
    };
  });
  const chcWithMods =
    aggregateBuild(gear, ctx.shdLevel).chc + modAttrTotal(gearMods, "chc");
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
      axisContextFor(r.gear, r.damage.effectiveDps, ctx, role),
    );
    const adm = exoticAdmissible(r.gear)
      ? checkAdmissibility(admissibilityInput(r.gear, vector, role, ctx))
      : { admissible: false, violations: [{ kind: "team_buff_source" as const, label: "Exotic-Limit: höchstens ein exotisches Ausrüstungsteil", actual: null, required: null }] };
    out.push({
      id: [...r.gear.map((g) => g.id)].sort().join("|") + "::" + r.weapon.id,
      gear: r.gear,
      weapon: r.weapon,
      vector,
      admissible: adm.admissible,
      violations: adm.violations,
      violationCount: adm.violations.length,
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

export function optimizeV4(
  weapons: Weapon[],
  gear: GearPiece[],
  ctx: ModeContext,
  opts: {
    setBonusCatalog?: unknown;
    modsBySlot?: Record<string, { name: string; slotTypes: string[]; bonus: { type: string; val: number } | null; penalty?: { type: string; val: number } | null }[]>;
    maxResults?: number;
    budgetPerSlot?: number;
  } = {},
): V4BuildResult {
  const start = Date.now();
  const role = roleProfile(ctx.roleKey);
  const warnings: string[] = [];

  let candidateGear = gear;
  if (ctx.mode === "ziel") {
    const reduced = reduceSearchSpace(gear, role, opts.budgetPerSlot ?? 12);
    candidateGear = reduced.gear;
    if (reduced.pruned > 0) {
      warnings.push(
        `Ziel-Build: Suchraum reduziert — ${reduced.pruned} aussichtslose Teile pro Slot-Ranking entfernt (Budget ${opts.budgetPerSlot ?? 12} je Slot).`,
      );
    }
  }

  const optimizerResults = optimizeBuilds(
    weapons,
    candidateGear,
    ctx.shdLevel,
    ctx.settings,
    {
      maxResults: opts.maxResults ?? 30,
      spec: ctx.spec,
      considerMods: true,
      modsBySlot: opts.modsBySlot as never,
      setBonusCatalog: (opts.setBonusCatalog as never) ?? defaultSetBonusCatalog(),
    },
  );

  const candidates = buildCandidatesFromOptimizer(optimizerResults, ctx, role);
  const ranking = rankBuilds(
    role,
    candidates.map((c) => ({
      id: c.id,
      vector: c.vector,
      admissible: c.admissible,
      violations: c.violations,
      violationCount: c.violationCount,
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

function defaultSetBonusCatalog(): SetBonusCatalog {
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
