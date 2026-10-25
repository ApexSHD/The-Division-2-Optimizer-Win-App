import type { Weapon } from "./sampleData";
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
