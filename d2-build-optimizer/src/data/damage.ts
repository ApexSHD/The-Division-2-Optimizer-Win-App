import type { Weapon, GearSlot } from "./sampleData";
import type { GearPiece } from "./sampleData";
import type { OptimizationSettings } from "../store";
import { shdBonusFor } from "../store";

export interface EnemyProfile {
  armor: number;
  health: number;
  ooc: number;
  headshot: number;
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
  };
  for (const g of gear) {
    if (g.core === "wd") stats.wd += g.coreValue;
    for (const a of g.attributes) {
      switch (a.type) {
        case "chc": stats.chc += a.value; break;
        case "chd": stats.chd += a.value; break;
        case "hsd": stats.hsd += a.value; break;
        case "dta": stats.dta += a.value; break;
        case "dth": stats.dth += a.value; break;
        case "dttooc": stats.dttooc += a.value; break;
        case "wd": stats.wd += a.value; break;
        default: break;
      }
    }
  }
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


export interface OptimizerResult {
  rank: number;
  weapon: Weapon;
  gear: GearPiece[];
  stats: BuildStats;
  damage: DamageBreakdown;
  meetsTargetChc: boolean;
  gearSetCount: number;
  reason: string;
}

const SLOTS: GearSlot[] = ["mask", "chest", "holster", "backpack", "gloves", "kneepads"];

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

  const bySlot = new Map<GearSlot, GearPiece[]>();
  for (const slot of SLOTS) bySlot.set(slot, []);
  for (const g of gear) bySlot.get(g.slot)?.push(g);

  if (settings.requiredChest && (bySlot.get("chest")?.length ?? 0) === 0) return [];
  if (settings.requiredBackpack && (bySlot.get("backpack")?.length ?? 0) === 0) return [];

  const targetSet = settings.targetGearSet.trim().toLowerCase();
  const results: OptimizerResult[] = [];
  const seen = new Set<string>();

  const gearCombos = cartesianBySlot(bySlot);

  for (const w of weapons) {
    for (const combo of gearCombos) {
      if (combo.length === 0) continue;
      const exoticGear = combo.filter((g) => g.brandType === "exotic").length;
      if (exoticGear > 1) continue;
      if (settings.requiredChest && !combo.some((g) => g.slot === "chest")) continue;
      if (settings.requiredBackpack && !combo.some((g) => g.slot === "backpack")) continue;

      const setPieces = combo.filter((g) => g.brandType === "gearset");
      let gearSetCount = 0;
      if (targetSet) {
        const matching = piecesOfSet(setPieces, targetSet, gearSetNames);
        if (matching < 2) continue;
        gearSetCount = matching;
      }

      const stats = aggregateBuild(combo, shdLevel);
      const damage = computeDamage(w, stats, profile);
      const meetsTargetChc = damage.cappedChc >= settings.targetChc;

      const key = combo.map((g) => g.id).join("|") + "::" + w.id;
      if (seen.has(key)) continue;
      seen.add(key);

      const reasonParts: string[] = [];
      reasonParts.push(meetsTargetChc
        ? `CHC-Ziel ${settings.targetChc} % erreicht (${damage.cappedChc} %)`
        : `CHC ${damage.cappedChc} % unter Ziel ${settings.targetChc} %`);
      if (targetSet && gearSetCount > 0) reasonParts.push(`${gearSetCount}× ${settings.targetGearSet}`);
      if (exoticGear === 1) reasonParts.push("1 Exotic-Gear");

      results.push({
        rank: 0,
        weapon: w,
        gear: combo,
        stats,
        damage,
        meetsTargetChc,
        gearSetCount,
        reason: reasonParts.join(" · "),
      });
    }
  }

  results.sort((a, b) => {
    if (a.meetsTargetChc !== b.meetsTargetChc) return a.meetsTargetChc ? -1 : 1;
    return b.damage.effectiveDps - a.damage.effectiveDps;
  });
  const top = results.slice(0, maxResults);
  top.forEach((r, i) => (r.rank = i + 1));
  return top;
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
