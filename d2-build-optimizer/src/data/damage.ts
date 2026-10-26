import type { Weapon, GearSlot, GearAttr, GearAttrKey } from "./sampleData";
import type { GearPiece } from "./sampleData";
import { GEAR_ATTR_TYPES, gearAttrMax } from "./sampleData";
import type { OptimizationSettings } from "../store";
import { shdBonusFor } from "../store";

export interface EnemyProfile {
  armor: number;
  health: number;
  ooc: number;
  headshot: number;
}

export interface StatSource {
  itemId: string;
  label: string;
  value: number;
}

export interface BuildStats {
  wd: number;
  chc: number;
  chd: number;
  hsd: number;
  dta: number;
  dth: number;
  dttooc: number;
  totalWd: number;
  amp: number[];
  sources: Record<string, StatSource[]>;
}

export interface DamageBreakdown {
  rawHit: number;
  nonCritBody: number;
  nonCritHit: number;
  critHit: number;
  avgBulletDmg: number;
  effectiveDps: number;
  finalChc: number;
  cappedChc: number;
  finalChd: number;
}

const CHC_CAP = 60;

export function enemyProfileFromSettings(o: OptimizationSettings): EnemyProfile {
  const armor = Math.max(0, Math.min(100, o.enemyArmorShare)) / 100;
  const health = Math.max(0, Math.min(100, o.enemyHealthShare)) / 100;
  const sum = armor + health;
  const a = sum > 0 ? armor / sum : 0.8;
  const h = 1 - a;
  return {
    armor: a,
    health: h,
    ooc: Math.max(0, Math.min(100, o.enemyOocShare)) / 100,
    headshot: Math.max(0, Math.min(100, o.enemyHeadshotShare)) / 100,
  };
}

export function aggregateBuild(
  gear: GearPiece[],
  shdLevel: number,
): BuildStats {
  const stats: BuildStats = {
    wd: 0,
    chc: 0,
    chd: 0,
    hsd: 0,
    dta: 0,
    dth: 0,
    dttooc: 0,
    totalWd: 0,
    amp: [],
    sources: {},
  };
  const addSource = (key: string, src: StatSource) => {
    (stats.sources[key] ??= []).push(src);
  };
  for (const g of gear) {
    const label = `${g.brand} (${g.slot})`;
    if (g.core === "wd") {
      stats.wd += g.coreValue;
      addSource("wd", { itemId: g.id, label: `${label} — Kern`, value: g.coreValue });
    }
    for (const a of g.attributes) {
      const attrLabel = `${label} — ${GEAR_ATTR_TYPES[a.type]?.label ?? a.type}`;
      switch (a.type) {
        case "chc": stats.chc += a.value; addSource("chc", { itemId: g.id, label: attrLabel, value: a.value }); break;
        case "chd": stats.chd += a.value; addSource("chd", { itemId: g.id, label: attrLabel, value: a.value }); break;
        case "hsd": stats.hsd += a.value; addSource("hsd", { itemId: g.id, label: attrLabel, value: a.value }); break;
        case "dta": stats.dta += a.value; addSource("dta", { itemId: g.id, label: attrLabel, value: a.value }); break;
        case "dth": stats.dth += a.value; addSource("dth", { itemId: g.id, label: attrLabel, value: a.value }); break;
        case "dttooc": stats.dttooc += a.value; addSource("dttooc", { itemId: g.id, label: attrLabel, value: a.value }); break;
        case "wd": stats.wd += a.value; addSource("wd", { itemId: g.id, label: attrLabel, value: a.value }); break;
        default: break;
      }
    }
  }
  const shd = (key: string, val: number) => {
    if (val > 0) addSource(key, { itemId: "shd-watch", label: "SHD-Uhr", value: val });
  };
  shd("wd", shdBonusFor(shdLevel, "wd"));
  shd("chc", shdBonusFor(shdLevel, "chc"));
  shd("chd", shdBonusFor(shdLevel, "chd"));
  stats.wd += shdBonusFor(shdLevel, "wd");
  stats.chc += shdBonusFor(shdLevel, "chc");
  stats.chd += shdBonusFor(shdLevel, "chd");
  return stats;
}

export interface WeaponTalentDamage {
  wd: number;
  amp: number;
}

export function computeDamage(
  weapon: Weapon,
  build: BuildStats,
  profile: EnemyProfile,
  opts: {
    weaponTypeWd?: number;
    talentTotalWd?: number;
    talentAmps?: number[];
  } = {},
): DamageBreakdown {
  const knowHowMult = 1 + weapon.knowHow / 100;

  const weaponTypeWd = opts.weaponTypeWd ?? 0;
  const talentTotalWd = opts.talentTotalWd ?? 0;

  const wdCat = weapon.attributes.core1 + build.wd + weaponTypeWd;
  const wdMult = 1 + wdCat / 100;
  const twdMult = 1 + talentTotalWd / 100;

  const rawHit = weapon.baseDamage * knowHowMult * wdMult * twdMult;

  const dtaMult = 1 + (build.dta / 100) * profile.armor;
  const dthMult = 1 + (build.dth / 100) * profile.health;
  const dttoocMult = 1 + (build.dttooc / 100) * profile.ooc;

  const amps = [...build.amp, ...(opts.talentAmps ?? [])];
  const ampMult = amps.reduce((m, a) => m * (1 + a / 100), 1);

  const nonCritBody = rawHit * dtaMult * dthMult * dttoocMult * ampMult;

  const hsdShare = profile.headshot;
  const hsdMult = 1 + (build.hsd / 100) * hsdShare;
  const nonCritHit = nonCritBody * ((1 - hsdShare) + hsdShare * hsdMult);

  const finalChc = Math.min(build.chc, CHC_CAP);
  const finalChd = build.chd;
  const critHit = nonCritHit * (1 + finalChd / 100);

  const avgBulletDmg =
    nonCritHit * (1 - finalChc / 100) + critHit * (finalChc / 100);

  const rofMult = 1 + (weapon.attributes.core2Type === "rof" ? weapon.attributes.core2Val / 100 : 0);
  const effectiveDps = (avgBulletDmg * weapon.rpm * rofMult) / 60;

  return {
    rawHit,
    nonCritBody,
    nonCritHit,
    critHit,
    avgBulletDmg,
    effectiveDps,
    finalChc,
    cappedChc: finalChc,
    finalChd,
  };
}


export interface CalibrationHint {
  attribute: string;
  attributeLabel: string;
  currentPercent: number;
  currentValue: number;
  maxValue: number;
}

export interface SlotExplanation {
  slot: GearSlot;
  chosen: GearPiece;
  score: number;
  reason: string;
  runnerUp: {
    item: GearPiece;
    dpsDelta: number;
    reason: string;
  } | null;
  calibrationHint: CalibrationHint | null;
}

export interface OptimizerWarning {
  level: "yellow" | "red";
  message: string;
}

export interface OptimizerResult {
  rank: number;
  weapon: Weapon;
  gear: GearPiece[];
  stats: BuildStats;
  damage: DamageBreakdown;
  meetsTargetChc: boolean;
  gearSetCount: number;
  reason: string;
  slotExplanations: SlotExplanation[];
  warnings: OptimizerWarning[];
}

const SLOTS: GearSlot[] = ["mask", "chest", "holster", "backpack", "gloves", "kneepads"];

const DMG_ATTR_KEYS: GearAttrKey[] = ["chc", "chd", "hsd", "dta", "dth", "dttooc", "wd"];

function bestDamageAttr(g: GearPiece): { attr: GearAttr; percent: number } | null {
  const attrs = g.attributes.filter((a) => (DMG_ATTR_KEYS as string[]).includes(a.type));
  if (attrs.length === 0) return null;
  let best: { attr: GearAttr; percent: number } | null = null;
  for (const attr of attrs) {
    const max = gearAttrMax(attr.type, g.prototype);
    if (max == null || max <= 0) continue;
    const percent = (attr.value / max) * 100;
    if (!best || percent > best.percent) best = { attr, percent };
  }
  return best;
}

function calibrationHintFor(g: GearPiece): CalibrationHint | null {
  const best = bestDamageAttr(g);
  if (!best) return null;
  const max = gearAttrMax(best.attr.type, g.prototype);
  if (max == null || max <= 0) return null;
  if (best.percent >= 99.5) return null;
  return {
    attribute: best.attr.type,
    attributeLabel: GEAR_ATTR_TYPES[best.attr.type].label,
    currentPercent: Number(best.percent.toFixed(1)),
    currentValue: best.attr.value,
    maxValue: max,
  };
}

function slotExplanationsFor(
  combo: GearPiece[],
  weapon: Weapon,
  shdLevel: number,
  profile: EnemyProfile,
  bySlot: Map<GearSlot, GearPiece[]>,
  settings: OptimizationSettings,
): SlotExplanation[] {
  const chosenIds = new Set(combo.map((g) => g.id));
  return combo.map((chosen) => {
    const others = (bySlot.get(chosen.slot) ?? []).filter((g) => !chosenIds.has(g.id));
    const baseStats = aggregateBuild(combo, shdLevel);
    const baseDamage = computeDamage(weapon, baseStats, profile);

    let runnerUp: SlotExplanation["runnerUp"] = null;
    for (const other of others) {
      const stats = aggregateBuild(
        combo.map((g) => (g.slot === chosen.slot ? other : g)),
        shdLevel,
      );
      const damage = computeDamage(weapon, stats, profile);
      const delta = baseDamage.effectiveDps - damage.effectiveDps;
      if (!runnerUp || delta > runnerUp.dpsDelta) {
        runnerUp = {
          item: other,
          dpsDelta: delta,
          reason: other.brand === chosen.brand ? "gleiche Marke" : "andere Marke",
        };
      }
    }

    const bestAttr = bestDamageAttr(chosen);
    let reason = bestAttr
      ? `${GEAR_ATTR_TYPES[bestAttr.attr.type].label} ${bestAttr.percent.toFixed(0)} % vom Maximalwert`
      : chosen.talent
        ? `Talent ${chosen.talent}`
        : `Bester verfügbarbarer ${chosen.slot}-Kandidat`;

    let score = 100;
    if (runnerUp && baseDamage.effectiveDps > 0) {
      score = Number(
        ((baseDamage.effectiveDps / (baseDamage.effectiveDps + runnerUp.dpsDelta)) * 100).toFixed(1),
      );
    }
    if (settings.targetGearSet && chosen.brandType === "gearset") {
      const t = settings.targetGearSet.trim().toLowerCase();
      if (chosen.brand.toLowerCase().includes(t)) reason += ` · passt zum Set-Ziel ${settings.targetGearSet}`;
    }

    return {
      slot: chosen.slot,
      chosen,
      score,
      reason,
      runnerUp,
      calibrationHint: calibrationHintFor(chosen),
    };
  });
}

function brandScoreBonusForCombo(combo: GearPiece[], preferredBrand: string): number {
  const pref = preferredBrand.trim().toLowerCase();
  if (!pref) return 0;
  return combo.filter((g) => g.brand.toLowerCase().includes(pref)).length;
}

function isGodRoll(g: GearPiece): boolean {
  return g.attributes.every((a) => {
    const max = gearAttrMax(a.type, g.prototype);
    return max == null || max <= 0 || a.value >= max * 0.999;
  });
}

export function optimizeBuilds(
  weapons: Weapon[],
  gear: GearPiece[],
  shdLevel: number,
  settings: OptimizationSettings,
  opts: { gearSetNames?: string[]; maxResults?: number } = {},
): OptimizerResult[] {
  const profile = enemyProfileFromSettings(settings);
  const maxResults = opts.maxResults ?? 10;
  const gearSetNames = new Set((opts.gearSetNames ?? []).map((n) => n.toLowerCase()));

  const targetSet = settings.targetGearSet.trim().toLowerCase();

  const fallbackWarnings: OptimizerWarning[] = [];

  const anchorWeapon = weapons.find((w) => w.id === settings.anchorWeaponId) ?? null;
  const candidateWeapons = anchorWeapon ? [anchorWeapon] : weapons;
  if (anchorWeapon) {
    fallbackWarnings.push({
      level: "yellow",
      message: `Anker aktiv: Alle Builds werden um \u201e${anchorWeapon.name}\u201c herum berechnet.`,
    });
  }

  const lockedSet = new Set(settings.lockedGearIds.filter((id) => gear.some((g) => g.id === id)));
  for (const id of settings.lockedGearIds) {
    if (!lockedSet.has(id)) {
      fallbackWarnings.push({
        level: "yellow",
        message: "Gesperrtes Teil nicht (mehr) im Inventar \u2014 Lock wurde \u00fcbergangen.",
      });
    }
  }
  const lockedGear = gear.filter((g) => lockedSet.has(g.id));

  let candidateGear = gear;
  if (settings.qualityFilter === "godRoll") {
    candidateGear = gear.filter((g) => lockedSet.has(g.id) || isGodRoll(g));
  }

  const bySlot = new Map<GearSlot, GearPiece[]>();
  for (const slot of SLOTS) bySlot.set(slot, []);
  for (const g of candidateGear) bySlot.get(g.slot)?.push(g);

  let requireChest = settings.requiredChest;
  if (requireChest && (bySlot.get("chest")?.length ?? 0) === 0) {
    requireChest = false;
    fallbackWarnings.push({
      level: "yellow",
      message: "Keine Weste im Inventar — Pflicht-Weste wurde übergangen, bester Ersatz gewählt.",
    });
  }
  let requireBackpack = settings.requiredBackpack;
  if (requireBackpack && (bySlot.get("backpack")?.length ?? 0) === 0) {
    requireBackpack = false;
    fallbackWarnings.push({
      level: "yellow",
      message: "Kein Rucksack im Inventar — Pflicht-Rucksack wurde übergangen, bester Ersatz gewählt.",
    });
  }

  interface PassConfig {
    minSetPieces: number;
    warnings: OptimizerWarning[];
  }
  const passes: PassConfig[] = [{ minSetPieces: 2, warnings: [] }];
  if (targetSet) {
    passes.push({
      minSetPieces: 1,
      warnings: [{
        level: "yellow",
        message: `Nur 1 statt 2 Teile von „${settings.targetGearSet}“ im Inventar gefunden — es wurde stattdessen ein Teil mit ähnlichen Stats ergänzt.`,
      }],
    });
    passes.push({
      minSetPieces: 0,
      warnings: [{
        level: "yellow",
        message: `Set-Ziel „${settings.targetGearSet}“ nicht erfüllbar — es wurden die nächstbesten Teile aus dem Inventar gewählt.`,
      }],
    });
  }

  const gearCombos = cartesianBySlot(bySlot);

  const results = runOptimizerPasses(
    candidateWeapons,
    gearCombos,
    shdLevel,
    settings,
    profile,
    gearSetNames,
    targetSet,
    requireChest,
    requireBackpack,
    passes,
    fallbackWarnings,
    lockedGear,
  );

  const brandBonus = (r: OptimizerResult) =>
    brandScoreBonusForCombo(r.gear, settings.preferredBrand);
  results.sort((a, b) => {
    if (a.meetsTargetChc !== b.meetsTargetChc) return a.meetsTargetChc ? -1 : 1;
    const brandDiff = brandBonus(b) - brandBonus(a);
    if (brandDiff !== 0) return brandDiff;
    return b.damage.effectiveDps - a.damage.effectiveDps;
  });
  const top = results.slice(0, maxResults);
  top.forEach((r, i) => {
    r.rank = i + 1;
    r.slotExplanations = slotExplanationsFor(
      r.gear,
      r.weapon,
      shdLevel,
      profile,
      bySlot,
      settings,
    );
  });
  return top;
}

function runOptimizerPasses(
  weapons: Weapon[],
  gearCombos: GearPiece[][],
  shdLevel: number,
  settings: OptimizationSettings,
  profile: EnemyProfile,
  gearSetNames: Set<string>,
  targetSet: string,
  requireChest: boolean,
  requireBackpack: boolean,
  passes: { minSetPieces: number; warnings: OptimizerWarning[] }[],
  fallbackWarnings: OptimizerWarning[],
  lockedGear: GearPiece[],
): OptimizerResult[] {
  const seen = new Set<string>();

  for (const pass of passes) {
    const results: OptimizerResult[] = [];
    for (const w of weapons) {
      for (const combo of gearCombos) {
        if (combo.length === 0) continue;
        if (lockedGear.some((lg) => !combo.some((g) => g.id === lg.id))) continue;
        const exoticGear = combo.filter((g) => g.brandType === "exotic").length;
        if (exoticGear > 1) continue;
        if (requireChest && !combo.some((g) => g.slot === "chest")) continue;
        if (requireBackpack && !combo.some((g) => g.slot === "backpack")) continue;

        const setPieces = combo.filter((g) => g.brandType === "gearset");
        let gearSetCount = 0;
        if (targetSet && pass.minSetPieces > 0) {
          const matching = piecesOfSet(setPieces, targetSet, gearSetNames);
          if (matching < pass.minSetPieces) continue;
          gearSetCount = matching;
        }

        const stats = aggregateBuild(combo, shdLevel);
        const damage = computeDamage(w, stats, profile);
        const meetsTargetChc = damage.cappedChc >= settings.targetChc;

        const key = combo.map((g) => g.id).join("|") + "::" + w.id;
        if (seen.has(key)) continue;

        const reasonParts: string[] = [];
        reasonParts.push(meetsTargetChc
          ? `CHC-Ziel ${settings.targetChc} % erreicht (${damage.cappedChc} %)`
          : `CHC ${damage.cappedChc} % unter Ziel ${settings.targetChc} %`);
        if (targetSet && gearSetCount > 0) reasonParts.push(`${gearSetCount}\u00d7 ${settings.targetGearSet}`);
        if (exoticGear === 1) reasonParts.push("1 Exotic-Gear");

        results.push({
          rank: 0,
          weapon: w,
          gear: combo,
          stats,
          damage,
          meetsTargetChc,
          gearSetCount,
          reason: reasonParts.join(" \u00b7 "),
          slotExplanations: [],
          warnings: [...fallbackWarnings, ...pass.warnings],
        });
        seen.add(key);
      }
    }
    if (results.length > 0) return results;
  }
  return [];
}

function piecesOfSet(setPieces: GearPiece[], targetSet: string, knownSets: Set<string>): number {
  const t = targetSet.toLowerCase();
  return setPieces.filter((g) => {
    const brand = g.brand.toLowerCase();
    if (brand === t) return true;
    if (knownSets.has(brand) && brand.includes(t)) return true;
    return t.length > 2 && brand.includes(t);
  }).length;
}

function cartesianBySlot(bySlot: Map<GearSlot, GearPiece[]>): GearPiece[][] {
  let combos: GearPiece[][] = [[]];
  for (const slot of SLOTS) {
    const items = bySlot.get(slot) ?? [];
    const next: GearPiece[][] = [];
    for (const c of combos) {
      next.push(c);
      for (const item of items) next.push([...c, item]);
    }
    combos = next;
    if (combos.length > 200000) combos = combos.slice(0, 200000);
  }
  return combos.filter((c) => c.length > 0);
}
