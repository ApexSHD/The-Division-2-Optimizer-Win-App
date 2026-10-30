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

function addStatSource(stats: BuildStats, key: string, label: string, value: number, itemId = "misc") {
  (stats.sources[key] ??= []).push({ itemId, label, value });
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

export type SpecId = "demolitionist" | "gunner" | "sharpshooter" | "survivalist" | "technician" | "firewall";

export interface SpecBonuses {
  hsd?: number;
  weaponTypeWd: Partial<Record<import("./sampleData").WeaponType, number>>;
}

// Nutzervorgabe 30.10.: Spezialisierungs-Skillbaum gewaehrt bis zu +15 % Waffenschaden
// fuer bis zu drei waehlbare Waffengattungen je Spec. Annahme: immer aktiv, da der Spieler
// nur mit zwei Gattungen spielt und die Baumwahl entsprechend trifft.
export const SPEC_PASSIVE_BONUSES: Record<SpecId, SpecBonuses> = {
  demolitionist: { weaponTypeWd: { lmg: 15, smg: 15, ar: 15 } },
  gunner: { weaponTypeWd: { ar: 15, lmg: 15, shotgun: 15 } },
  sharpshooter: { hsd: 25, weaponTypeWd: { mmr: 15, rifle: 15, ar: 15 } },
  survivalist: { weaponTypeWd: { rifle: 15, shotgun: 15, ar: 15 } },
  technician: { weaponTypeWd: { smg: 15, rifle: 15, mmr: 15 } },
  firewall: { weaponTypeWd: { shotgun: 15, smg: 15, ar: 15 } },
};

export interface ModContribution {
  slot: string;
  modName: string;
  attr: string;
  value: number;
}

const MOD_DAMAGE_ATTRS = new Set(["chc", "chd", "hsd", "wd"]);

export function bestModsForWeapon(
  weapon: import("./sampleData").Weapon,
  modsBySlot: Record<string, { name: string; slotTypes: string[]; bonus: { type: string; val: number } | null; penalty?: { type: string; val: number } | null }[]>,
): ModContribution[] {
  const result: ModContribution[] = [];
  for (const category of weapon.modSlots) {
    const pool = (modsBySlot[category] ?? []).filter((m) => m.bonus && MOD_DAMAGE_ATTRS.has(m.bonus.type));
    let best: { name: string; bonus: { type: string; val: number }; score: number } | null = null;
    for (const m of pool) {
      if (!m.bonus) continue;
      const penaltyBad = m.penalty && MOD_DAMAGE_ATTRS.has(m.penalty.type) ? Math.abs(m.penalty.val) : 0;
      const score = m.bonus.val - penaltyBad;
      if (!best || score > best.score) {
        best = { name: m.name, bonus: m.bonus, score };
      }
    }
    if (best) {
      result.push({ slot: category, modName: best.name, attr: best.bonus.type, value: best.bonus.val });
    }
  }
  return result;
}

function applyModContributions(stats: BuildStats, mods: ModContribution[]): BuildStats {
  const next: BuildStats = {
    ...stats,
    sources: Object.fromEntries(
      Object.entries(stats.sources).map(([k, v]) => [k, [...v]]),
    ),
  };
  for (const m of mods) {
    const label = `Mod (${m.modName})`;
    switch (m.attr) {
      case "chc": next.chc += m.value; addStatSource(next, "chc", label, m.value); break;
      case "chd": next.chd += m.value; addStatSource(next, "chd", label, m.value); break;
      case "hsd": next.hsd += m.value; addStatSource(next, "hsd", label, m.value); break;
      case "wd": next.wd += m.value; addStatSource(next, "wd", label, m.value); break;
      default: break;
    }
  }
  return next;
}

export function specBonusFor(weapon: import("./sampleData").Weapon, spec: string): { hsd: number; weaponTypeWd: number } {
  const bonuses = SPEC_PASSIVE_BONUSES[spec as SpecId];
  if (!bonuses) return { hsd: 0, weaponTypeWd: 0 };
  return {
    hsd: bonuses.hsd ?? 0,
    weaponTypeWd: bonuses.weaponTypeWd[weapon.type] ?? 0,
  };
}

export type RoleScoreKey = "weaponDps" | "skillBurst" | "statusCc" | "tankRegen";

export interface RoleScore {
  key: RoleScoreKey | "";
  score: number;
  label: string;
}

function roleScoreFor(gear: GearPiece[], key: string): RoleScore {
  const sumAttr = (types: string[]) =>
    gear.reduce(
      (acc, g) =>
        acc + g.attributes.filter((a) => types.includes(a.type)).reduce((x, a) => x + a.value, 0),
      0,
    );
  const coreCount = (core: "wd" | "armour" | "skill") => gear.filter((g) => g.core === core).length;

  switch (key) {
    case "skillBurst": {
      const skillDmg = sumAttr(["skilldmg"]);
      const skillHaste = sumAttr(["skillhaste"]);
      const tiers = coreCount("skill");
      return {
        key: "skillBurst",
        score: Number((skillDmg + skillHaste * 0.5 + tiers * 10).toFixed(2)),
        label: `Skill-Schaden +${skillDmg} % · Tempo +${skillHaste} % · ${tiers} Skill-Tier(s)`,
      };
    }
    case "statusCc": {
      const status = sumAttr(["status"]);
      const haste = sumAttr(["skillhaste"]);
      return {
        key: "statusCc",
        score: Number((status + haste * 0.25).toFixed(2)),
        label: `Statuseffekte +${status} % · Skill-Tempo +${haste} %`,
      };
    }
    case "tankRegen": {
      const regen = sumAttr(["armorregen", "health", "hazard", "explres", "aok", "incomrepair"]);
      const armors = coreCount("armour");
      return {
        key: "tankRegen",
        score: Number((regen / 100 + armors * 10).toFixed(2)),
        label: `Defensiv ${regen.toLocaleString("de-DE")} · ${armors} Rüstungs-Core(s)`,
      };
    }
    default:
      return { key: "", score: 0, label: "" };
  }
}

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
  shd("hsd", shdBonusFor(shdLevel, "hsd"));
  stats.wd += shdBonusFor(shdLevel, "wd");
  stats.chc += shdBonusFor(shdLevel, "chc");
  stats.chd += shdBonusFor(shdLevel, "chd");
  stats.hsd += shdBonusFor(shdLevel, "hsd");
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

  // WD-Kategorie: Waffen-Kern + Build + Spec (additiv)
  const wdCat = weapon.attributes.core1 + build.wd + weaponTypeWd;
  const wdMult = 1 + wdCat / 100;
  const twdMult = 1 + talentTotalWd / 100;

  const rawHit = weapon.baseDamage * knowHowMult * wdMult * twdMult;

  // FIX #78-2: Waffen-Minor-Attribut (core2, z.B. CHD bei Gewehren) einbeziehen
  const wa = weapon.attributes;
  const weaponChd = wa.core2Type === "chd" ? wa.core2Val : 0;
  const weaponHsd = wa.core2Type === "hsd" ? wa.core2Val : 0;
  const weaponChc = wa.core2Type === "chc" ? wa.core2Val : 0;
  const weaponDttooc = wa.core2Type === "dttooc" ? wa.core2Val : 0;
  const weaponDth = wa.core2Type === "dth" ? wa.core2Val : 0;
  const weaponDta = wa.core2Type === "dta" ? wa.core2Val : 0;

  // Minor-Attribute zaehlen in ihre Kategorie (additiv)
  const totalChc = build.chc + weaponChc;
  const finalChdBase = build.chd + weaponChd;
  const totalHsd = build.hsd + weaponHsd;
  const dttoocTotal = build.dttooc + weaponDttooc;
  const dthTotal = build.dth + weaponDth;
  const dtaTotal = build.dta + weaponDta;

  const dtahAvgAll =
    profile.armor * (1 + dtaTotal / 100) + profile.health * (1 + dthTotal / 100);
  const dttoocAvg = 1 + (dttoocTotal / 100) * profile.ooc;

  const amps = [...build.amp, ...(opts.talentAmps ?? [])];
  const ampMult = amps.reduce((m2, a) => m2 * (1 + a / 100), 1);

  const nonCritBody = rawHit * dtahAvgAll * dttoocAvg * ampMult;

  // FIX #82-2: CHD und HSD WIRKLICH additiv (gemeinsamer Bonus-Topf wie im Spiel).
  // nonCritHit bleibt der Kopfschuss-Sicht (mit HSD-Anteil); der Krit-Treffer addiert
  // CHD auf den HSD-Bonus statt auf den bereits erhoehten Treffer (kein HSD*CHD-Produkt).
  const hsdShare = profile.headshot;
  const nonCritHit = nonCritBody * (1 + (totalHsd / 100) * hsdShare);

  const finalChc = Math.min(totalChc, CHC_CAP);
  // gemeinsamer Topf: Treffer-Grundlage (nonCritBody) * (1 + HSD-Anteil + CHD)
  const critHit = nonCritBody * (1 + (totalHsd / 100) * hsdShare + finalChdBase / 100);

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
    finalChd: finalChdBase,
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

export interface OptimizerAssumptions {
  /** Nicht modellierte Effekte, die das Ergebnis beeinflussen koennen */
  items: { label: string; detail: string }[];
  /** CHC ueber dem Cap: verschwendeter Stat */
  wastedChc: number;
  /** CHC ueber dem Zielwert: ungenutzter Puffer */
  overTargetChc: number;
}

export interface GapSuggestion {
  slot: GearSlot;
  current: GearPiece | null;
  improvement: string;
  gainPercent: number;
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
  reasonParts: string[];
  slotExplanations: SlotExplanation[];
  warnings: OptimizerWarning[];
  roleScore: RoleScore;
  assumptions: OptimizerAssumptions;
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

export interface EvaluateContext {
  shdLevel: number;
  profile: EnemyProfile;
  spec?: string;
  modsBySlot?: Record<string, { name: string; slotTypes: string[]; bonus: { type: string; val: number } | null; penalty?: { type: string; val: number } | null }[]>;
  setBonusCatalog?: SetBonusCatalog | null;
}

/**
 * FIX #80-3: EINE Berechnungsfunktion fuer Optimierer, Feintuning, Lueckenanalyse und
 * Slot-Erklaerungen — mit Mods, Set-Boni und Spezialisierung konsistent.
 */
export function evaluateBuild(
  weapon: Weapon,
  gear: GearPiece[],
  ctx: EvaluateContext,
): { stats: BuildStats; damage: DamageBreakdown; modsUsed: ModContribution[] } {
  let stats = aggregateBuild(gear, ctx.shdLevel);
  const spec = specBonusFor(weapon, ctx.spec ?? "");
  if (spec.weaponTypeWd > 0) {
    stats.wd += spec.weaponTypeWd;
    addStatSource(stats, "wd", "Spezialisierung", spec.weaponTypeWd, "spec");
  }
  if (spec.hsd > 0) {
    stats.hsd += spec.hsd;
    addStatSource(stats, "hsd", "Spezialisierung", spec.hsd, "spec");
  }
  let modsUsed: ModContribution[] = [];
  if (ctx.modsBySlot) {
    modsUsed = bestModsForWeapon(weapon, ctx.modsBySlot);
    stats = applyModContributions(stats, modsUsed);
  }
  stats = applySetBonuses(stats, gear, weapon, ctx.setBonusCatalog ?? null);
  const damage = computeDamage(weapon, stats, ctx.profile, { weaponTypeWd: 0 });
  return { stats, damage, modsUsed };
}

function slotExplanationsFor(
  combo: GearPiece[],
  weapon: Weapon,
  bySlot: Map<GearSlot, GearPiece[]>,
  evalCtx: EvaluateContext,
  settings: OptimizationSettings,
): SlotExplanation[] {
  const chosenIds = new Set(combo.map((g) => g.id));
  const baseEval = evaluateBuild(weapon, combo, evalCtx);
  return combo.map((chosen) => {
    const others = (bySlot.get(chosen.slot) ?? []).filter((g) => !chosenIds.has(g.id));
    const baseDamage = baseEval.damage;

    let runnerUp: SlotExplanation["runnerUp"] = null;
    for (const other of others) {
      const { damage } = evaluateBuild(
        weapon,
        combo.map((g) => (g.slot === chosen.slot ? other : g)),
        evalCtx,
      );
      const delta = baseDamage.effectiveDps - damage.effectiveDps;
      if (!Number.isFinite(delta)) continue;
      if (!runnerUp || delta < runnerUp.dpsDelta) {
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

export interface SetBonusCatalog {
  brands: Record<string, Record<string, Record<string, unknown>>>;
  greens: Record<string, Record<string, { attr: string; val: number }[]>>;
}

const SET_BONUS_ATTR_MAP: Record<string, "chc" | "chd" | "hsd" | "wd" | "dta" | "dth" | "dttooc"> = {
  chc: "chc",
  chd: "chd",
  hsd: "hsd",
  wd: "wd",
};

function applySetBonuses(
  stats: BuildStats,
  combo: GearPiece[],
  weapon: import("./sampleData").Weapon,
  catalog: SetBonusCatalog | null,
): BuildStats {
  if (!catalog) return stats;
  const next: BuildStats = {
    ...stats,
    sources: Object.fromEntries(
      Object.entries(stats.sources).map(([k, v]) => [k, [...v]]),
    ),
  };

  const brandCounts = new Map<string, number>();
  for (const g of combo) {
    if (g.brandType === "brand") {
      const key = g.brand.toLowerCase().split(" ")[0];
      brandCounts.set(key, (brandCounts.get(key) ?? 0) + 1);
    }
  }
  for (const [brandKey, count] of brandCounts) {
    const tiers = catalog.brands[brandKey];
    if (!tiers) continue;
    for (const [pieces, bonusObj] of Object.entries(tiers)) {
      if (count < Number(pieces)) continue;
      for (const [attr, rawVal] of Object.entries(bonusObj)) {
        if (attr === "wd_by_weapon") {
          const byWeapon = rawVal as Record<string, number>;
          const weaponKey = weapon.type.toUpperCase();
          const val = byWeapon[weaponKey];
          if (val) {
            next.wd += val;
            addStatSource(next, "wd", `Set: ${brandKey} (${pieces} Teile, ${weaponKey})`, val, "set");
          }
          continue;
        }
        const mapped = SET_BONUS_ATTR_MAP[attr];
        const val = Number(rawVal);
        if (!mapped || !Number.isFinite(val)) continue;
        next[mapped] += val;
        addStatSource(next, mapped, `Set: ${brandKey} (${pieces} Teile)`, val, "set");
      }
    }
  }

  const greenCounts = new Map<string, number>();
  for (const g of combo) {
    if (g.brandType === "gearset") {
      const raw = g.brand.toLowerCase();
      const key =
        catalog.greens[raw] !== undefined
          ? raw
          : Object.keys(catalog.greens).find((k) => raw.startsWith(k) || k.startsWith(raw.split(" ")[0])) ?? raw;
      greenCounts.set(key, (greenCounts.get(key) ?? 0) + 1);
    }
  }
  for (const [greenKey, count] of greenCounts) {
    const tiers = catalog.greens[greenKey];
    if (!tiers) continue;
    for (const [pieces, bonuses] of Object.entries(tiers)) {
      if (count < Number(pieces)) continue;
      for (const b of bonuses) {
        const mapped = SET_BONUS_ATTR_MAP[b.attr];
        if (!mapped) continue;
        next[mapped] += b.val;
        addStatSource(next, mapped, `Set: ${greenKey} (${pieces} Teile)`, b.val, "set");
      }
    }
  }
  return next;
}

export function optimizeBuilds(
  weapons: Weapon[],
  gear: GearPiece[],
  shdLevel: number,
  settings: OptimizationSettings,
  opts: {
    gearSetNames?: string[];
    maxResults?: number;
    spec?: string;
    considerMods?: boolean;
    setBonusCatalog?: SetBonusCatalog | null;
    modsBySlot?: Record<string, { name: string; slotTypes: string[]; bonus: { type: string; val: number } | null; penalty?: { type: string; val: number } | null }[]>;
  } = {},
): OptimizerResult[] {
  const profile = enemyProfileFromSettings(settings);
  const maxResults = opts.maxResults ?? 10;
  const gearSetNames = new Set((opts.gearSetNames ?? []).map((n) => n.toLowerCase()));

  const targetSet = settings.targetGearSet.trim().toLowerCase();

  const fallbackWarnings: OptimizerWarning[] = [];

  const anchorWeapon = weapons.find((w) => w.id === settings.anchorWeaponId) ?? null;
  let candidateWeapons = anchorWeapon ? [anchorWeapon] : weapons;
  if (!anchorWeapon && settings.weaponTypeFilter) {
    candidateWeapons = candidateWeapons.filter((w) => w.type === settings.weaponTypeFilter);
    if (candidateWeapons.length === 0) {
      fallbackWarnings.push({
        level: "yellow",
        message: `Keine Waffe der Gattung \u201e${settings.weaponTypeFilter.toUpperCase()}\u201c im Inventar \u2014 Filter wurde zur\u00fcckgesetzt.`,
      });
      candidateWeapons = weapons;
    }
  }
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

  // FIX #78: Warnungs-Sammler separat — die Suchraum-Reduzierung laeuft im ersten
  // makeCombos()-Aufruf; Warnungen werden danach an die Ergebnisse gemergt.
  const searchWarnings: OptimizerWarning[] = [];
  const collectWarnings = (msg: string) => {
    searchWarnings.push({ level: "yellow", message: msg });
  };
  const makeCombos = () => cartesianBySlot(bySlot, lockedGear, collectWarnings);
  // Warmup: ersten Kandidaten ziehen, damit Pruning-Warnungen schon gesammelt sind
  const warmup = makeCombos();
  warmup.next();

  const results = runOptimizerPasses(
    candidateWeapons,
    makeCombos,
    shdLevel,
    settings,
    profile,
    gearSetNames,
    targetSet,
    requireChest,
    requireBackpack,
    passes,
    [...fallbackWarnings, ...searchWarnings],
    lockedGear,
    opts.spec ?? "",
    opts.setBonusCatalog ?? null,
    opts.modsBySlot,
  );

  const brandBonus = (r: OptimizerResult) =>
    brandScoreBonusForCombo(r.gear, settings.preferredBrand);
  const roleDriven = Boolean(settings.role) && settings.role !== "weaponDps";
  // FIX #82: Schaden primaer. Verschwendete CHC nur als FEINAbzug (0,2 Prozentpunkte Waste
  // = 0,2 % Score-Malus) - ein paar Prozentpunkte Waste duerfen niemals einen echten
  // DPS-Vorteil schlagen (Review-Beispiel: 5,5 % DPS vs. 5 PP Waste).
  const effectiveScore = (r: OptimizerResult) => {
    const wasteMalus = Math.min(0.2, r.assumptions.wastedChc * 0.002);
    if (roleDriven) return r.roleScore.score * (1 - wasteMalus);
    return r.damage.effectiveDps * (1 - wasteMalus);
  };
  results.sort((a, b) => {
    if (a.meetsTargetChc !== b.meetsTargetChc) return a.meetsTargetChc ? -1 : 1;
    const scoreDiff = effectiveScore(b) - effectiveScore(a);
    if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;
    return brandBonus(b) - brandBonus(a);
  });

  const top: OptimizerResult[] = [];
  // FIX #82-4: pro SLOT vergleichen (nicht Position), Waffenwechsel allein zaehlt nicht als divers
  const gearDiffCount = (a: OptimizerResult, b: OptimizerResult) => {
    const bySlotA = new Map(a.gear.map((g) => [g.slot, g.id]));
    let diff = 0;
    for (const g of b.gear) {
      if (bySlotA.get(g.slot) !== g.id) diff++;
    }
    return diff;
  };
  const isDiverse = (x: OptimizerResult) => top.every((t) => gearDiffCount(t, x) >= 2);
  for (const r of results) {
    if (top.length >= maxResults) break;
    if (top.length === 0 || isDiverse(r)) {
      if (!top.includes(r)) top.push(r);
    }
  }
  // Fallback: wenn die Liste noch nicht voll ist, keine diversen Kandidaten mehr uebrig — dann auffuellen
  if (top.length < maxResults) {
    // FIX #82-4: beim Auffuellen zulaessig sind (a) neue Gear-Kombinationen oder
    // (b) dieselbe Gear-Kombination mit einer ANDEREN Waffe (Waffenvergleich statt
    // leerer Liste) - aber nie beides identisch.
    const seen = new Set(top.map((r) => r.gear.map((g) => g.id).join("|") + "::" + r.weapon.id));
    for (const r of results) {
      if (top.length >= maxResults) break;
      const key = r.gear.map((g) => g.id).join("|") + "::" + r.weapon.id;
      if (seen.has(key)) continue;
      seen.add(key);
      top.push(r);
    }
  }
  top.forEach((r, i) => {
    r.rank = i + 1;
    r.slotExplanations = slotExplanationsFor(
      r.gear,
      r.weapon,
      bySlot,
      {
        shdLevel,
        profile,
        spec: (opts as { spec?: string }).spec,
        modsBySlot: opts.modsBySlot,
        setBonusCatalog: opts.setBonusCatalog ?? null,
      },
      settings,
    );
  });
  return top;
}

function runOptimizerPasses(
  weapons: Weapon[],
  makeCombos: () => Generator<GearPiece[]>,
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
  spec0: string,
  setBonusCatalog: SetBonusCatalog | null,
  modsBySlot: Record<string, { name: string; slotTypes: string[]; bonus: { type: string; val: number } | null; penalty?: { type: string; val: number } | null }[]> | undefined,
): OptimizerResult[] {
  const seen = new Set<string>();
  // FIX #78-6: begrenzte Bestenliste statt unbegrenztem results-Array (Speicherschutz)
  const KEEP_RESULTS = 200;

  for (const pass of passes) {
    const results: OptimizerResult[] = [];
    let passMinIdx = -1;
    let passMinScore = -Infinity;
    // FIX #80-1 + Performance: Kombis EINMAL pro Pass materialisieren (begrenzt durch
    // Slot-Pruning) und Waffen-Schleife innen laufen lassen — der Generator waere
    // pro Waffe erschöpft (Bug) und pro-Waffe-Neuerzeugung ist 30x zu teuer.
    const allCombos: GearPiece[][] = [...makeCombos()];
    const baseStatsCache = new Map<string, BuildStats>();
    const setBonusCache = new Map<string, BuildStats>();  // speichert nur Set-Boni-Deltas
    for (const combo of allCombos) {
      for (const w of weapons) {
        if (combo.length === 0) continue;
        if (lockedGear.some((lg) => !combo.some((g) => g.id === lg.id))) continue;
        const exoticGear = combo.filter((g) => g.brandType === "exotic").length;
        // FIX #80-2: Spiel-Regel ist EINE Exotic-Waffe UND EIN Exotic-Gear (getrennt,
        // z.B. Coyote's Mask + Eagle Bearer) — nicht nur ein Exotic insgesamt
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

        const comboKey = combo.map((g) => g.id).join("|");
        let baseStats = baseStatsCache.get(comboKey);
        if (!baseStats) {
          baseStats = aggregateBuild(combo, shdLevel);
          baseStatsCache.set(comboKey, baseStats);
        }
        // Achtung Aliasing: applySetBonuses/applyModContributions erzeugen eigene Kopien;
        // die Basis-Sources werden hier geteilt, aber nur gelesen (Anzeige im Ergebnis via addStatSource
        // in die Kopie). Spec-Quellen werden in applySetBonuses-Kopie angelegt — falls kein Mod/Set
        // kopiert, ist stats === baseStats-Referenz auf OK lesende Weise; addStatSource("spec") schreibt
        // in das geteilte Array — deshalb hier eine flache Kopie mit Array-Klonen NUR wenn spec aktiv:
        const specB = specBonusFor(w, spec0);
        let stats: BuildStats =
          specB.weaponTypeWd > 0 || specB.hsd > 0
            ? {
                ...baseStats,
                sources: Object.fromEntries(
                  Object.entries(baseStats.sources).map(([k, v]) => [k, [...v]]),
                ),
              }
            : { ...baseStats, sources: baseStats.sources };
        const spec = specB;
        if (spec.weaponTypeWd > 0) {
          stats.wd += spec.weaponTypeWd;
          addStatSource(stats, "wd", "Spezialisierung", spec.weaponTypeWd, "spec");
        }
        if (spec.hsd > 0) {
          stats.hsd += spec.hsd;
          addStatSource(stats, "hsd", "Spezialisierung", spec.hsd, "spec");
        }
        let modsUsed: ModContribution[] = [];
        if (modsBySlot) {
          modsUsed = bestModsForWeapon(w, modsBySlot);
          stats = applyModContributions(stats, modsUsed);
        }
        // FIX #82-1: Cache speichert nur die Set-Boni-DELTAS (nicht komplette Stats mit
        // Mods/Spec der ersten Waffe desselben Typs). Deltas werden auf die eigenen Werte addiert.
        const setKey = comboKey + "::" + w.type;
        let setDelta: BuildStats | undefined = setBonusCache.get(setKey);
        if (!setDelta) {
          const applied = applySetBonuses({ ...stats, wd: 0, chc: 0, chd: 0, hsd: 0, dta: 0, dth: 0, dttooc: 0, totalWd: 0, amp: [], sources: {} }, combo, w, setBonusCatalog);
          setDelta = { ...stats, wd: applied.wd, chc: applied.chc, chd: applied.chd, hsd: applied.hsd, dta: applied.dta, dth: applied.dth, dttooc: applied.dttooc, totalWd: 0, amp: applied.amp, sources: applied.sources };
          setBonusCache.set(setKey, setDelta);
        }
        stats = {
          ...stats,
          wd: stats.wd + setDelta.wd,
          chc: stats.chc + setDelta.chc,
          chd: stats.chd + setDelta.chd,
          hsd: stats.hsd + setDelta.hsd,
          dta: stats.dta + setDelta.dta,
          dth: stats.dth + setDelta.dth,
          dttooc: stats.dttooc + setDelta.dttooc,
          amp: [...stats.amp, ...setDelta.amp],
          sources: { ...stats.sources, ...setDelta.sources },
        };
        const damage = computeDamage(w, stats, profile, { weaponTypeWd: 0 });
        const meetsTargetChc = damage.cappedChc >= settings.targetChc;

        const key = combo.map((g) => g.id).join("|") + "::" + w.id;
        if (seen.has(key)) continue;

        const reasonParts: string[] = [];
        reasonParts.push(meetsTargetChc
          ? `CHC-Ziel ${settings.targetChc} % erreicht (${damage.cappedChc} %)`
          : `CHC ${damage.cappedChc} % unter Ziel ${settings.targetChc} %`);
        if (targetSet && gearSetCount > 0) reasonParts.push(`${gearSetCount}\u00d7 ${settings.targetGearSet}`);
        if (exoticGear === 1) reasonParts.push("1 Exotic-Gear");

        const roleScore = settings.role && settings.role !== "weaponDps"
          ? roleScoreFor(combo, settings.role)
          : { key: "" as const, score: damage.effectiveDps, label: "Waffen-DPS" };

        // FIX #82-3: Waffen-CHC (core2) zaehlt im Cap mit - Verschwendung korrekt berechnen
        const totalChcForWaste = stats.chc + (w.attributes.core2Type === "chc" ? w.attributes.core2Val : 0);
        const wastedChc = Math.max(0, totalChcForWaste - CHC_CAP);
        const overTargetChc = Math.max(0, Math.min(stats.chc, CHC_CAP) - settings.targetChc);
        const assumptions: OptimizerAssumptions = {
          items: [
            { label: "CHC-Cap 60 %", detail: wastedChc > 0 ? `${wastedChc.toFixed(1)} Prozentpunkte ueber dem Cap — verschwendeter Stat` : "kein Verschwendeter CHC" },
            { label: "Know-How", detail: `${w.knowHow} % auf den Grundschaden` },
            { label: "Gegnerprofil", detail: `Ruestung ${Math.round(profile.armor * 100)} %, Kopf ${Math.round(profile.headshot * 100)} %, ungedeckt ${Math.round(profile.ooc * 100)} %` },
            { label: "Talente/Exotic-Perks", detail: "nicht modelliert (siehe docs/FORMELN.md Abschnitt 8)" },
            { label: "SHD-Uhr", detail: "Verteilung pauschal angenommen (nicht mitoptimiert)" },
          ],
          wastedChc: Number(wastedChc.toFixed(1)),
          overTargetChc: Number(overTargetChc.toFixed(1)),
        };

        const candidate: OptimizerResult = {
          rank: 0,
          weapon: w,
          gear: combo,
          stats,
          damage,
          meetsTargetChc,
          gearSetCount,
          reason: reasonParts.join(" · "),
          reasonParts,
          slotExplanations: [],
          warnings: [...fallbackWarnings, ...pass.warnings],
          roleScore,
          assumptions,
        };
        seen.add(key);
        // FIX #78-6: begrenzte Bestenliste, schlechtestes per Score-Track effizient verwerfen
        const candScore = candidate.roleScore.key ? candidate.roleScore.score : candidate.damage.effectiveDps;
        if (passMinIdx === -1 || candScore > passMinScore) {
          results.push(candidate);
          if (results.length > KEEP_RESULTS) {
            // schlechtestes einmalig suchen (nur beim Ueberlauf)
            let worstIdx = 0;
            for (let i = 1; i < results.length; i++) {
              const wi = results[i].roleScore.key ? results[i].roleScore.score : results[i].damage.effectiveDps;
              const w0 = results[worstIdx].roleScore.key ? results[worstIdx].roleScore.score : results[worstIdx].damage.effectiveDps;
              if (wi < w0) worstIdx = i;
            }
            results.splice(worstIdx, 1);
            passMinIdx = worstIdx;
            passMinScore = results.reduce((min, r, i) => {
              const sc = r.roleScore.key ? r.roleScore.score : r.damage.effectiveDps;
              return sc < min.sc ? { sc, i } : min;
            }, { sc: Infinity, i: 0 }).sc;
          }
        }
      }
    }
    if (results.length > 0) return results;
  }
  return [];
}

export function analyzeGaps(
  best: OptimizerResult,
  gear: GearPiece[],
  shdLevel: number,
  settings: OptimizationSettings,
  opts: {
    gearSetNames?: string[];
    spec?: string;
    considerMods?: boolean;
    modsBySlot?: Record<string, { name: string; slotTypes: string[]; bonus: { type: string; val: number } | null; penalty?: { type: string; val: number } | null }[]>;
    setBonusCatalog?: SetBonusCatalog | null;
  } = {},
): GapSuggestion[] {
  const profile = enemyProfileFromSettings(settings);
  const baseDps = best.damage.effectiveDps;
  const suggestions: GapSuggestion[] = [];

  const perSlotBest = new Map<GearSlot, { dps: number; item: GearPiece }>();
  for (const slot of SLOTS) {
    const current = best.gear.find((g) => g.slot === slot);
    if (!current) continue;
    const candidates = gear.filter((g) => g.slot === slot && g.id !== current.id);
    for (const cand of candidates) {
      const combo = best.gear.map((g) => (g.slot === slot ? cand : g));
      // FIX #80-3: evaluateBuild — konsistent mit Optimierer (Mods + Set-Boni + Spec)
      const { damage: dmg } = evaluateBuild(best.weapon, combo, {
        shdLevel,
        profile,
        spec: opts.spec,
        modsBySlot: opts.modsBySlot,
        setBonusCatalog: opts.setBonusCatalog ?? null,
      });
      const gain = ((dmg.effectiveDps - baseDps) / (baseDps || 1)) * 100;
      const prev = perSlotBest.get(slot);
      if (gain > 0 && (!prev || dmg.effectiveDps > prev.dps)) {
        perSlotBest.set(slot, { dps: dmg.effectiveDps, item: cand });
        suggestions.push({
          slot,
          current,
          improvement: `${current.brand} → ${cand.brand}`,
          gainPercent: Number(gain.toFixed(1)),
        });
      }
    }
  }

  const bySlot = new Map<GearSlot, GapSuggestion>();
  for (const sug of suggestions) {
    const prev = bySlot.get(sug.slot);
    if (!prev || sug.gainPercent > prev.gainPercent) bySlot.set(sug.slot, sug);
  }
  return [...bySlot.values()].sort((a, b) => b.gainPercent - a.gainPercent);
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

// FIX #78-6: Suchraum hart begrenzen — 8 Kandidaten/Slot => deterministisch schnell;
// Specials (Talent/Named/Exotic/Set) werden davon unabhaengig immer gehalten
const MAX_CANDIDATES_PER_SLOT = 8;

function attrVector(g: GearPiece): Record<string, number> {
  const v: Record<string, number> = { core: g.core === "wd" ? g.coreValue : 0 };
  for (const a of g.attributes) v[a.type] = (v[a.type] ?? 0) + a.value;
  return v;
}

function dominates(a: GearPiece, b: GearPiece): boolean {
  if (a.id === b.id) return false;
  const va = attrVector(a);
  const vb = attrVector(b);
  const keys = new Set([...Object.keys(va), ...Object.keys(vb)]);
  let better = false;
  for (const k of keys) {
    const av = va[k] ?? 0;
    const bv = vb[k] ?? 0;
    if (av < bv) return false;
    if (av > bv) better = true;
  }
  return better;
}

function pruneSlotCandidates(items: GearPiece[], locked: GearPiece[]): GearPiece[] {
  if (items.length <= MAX_CANDIDATES_PER_SLOT) return items;
  const lockedIds = new Set(locked.map((g) => g.id));
  const kept: GearPiece[] = items.filter((g) => lockedIds.has(g.id));
  let pool = items.filter((g) => !lockedIds.has(g.id));

  // FIX #78-5: Spezielle Teile nie wegwerfen — Ziel-Set, Named, Exotic, Talent
  const special: GearPiece[] = [];
  const regular: GearPiece[] = [];
  for (const g of pool) {
    if (g.brandType === "gearset" || g.brandType === "named" || g.brandType === "exotic" || g.talent) {
      special.push(g);
    } else {
      regular.push(g);
    }
  }

  // Dominanz nur innerhalb gleicher Marke + Kern + Talent vergleichen
  const nonDominated: GearPiece[] = [];
  for (const g of regular) {
    const dominatedBy = regular.some(
      (o) =>
        o !== g &&
        o.brand === g.brand &&
        o.core === g.core &&
        (o.talent ?? "") === (g.talent ?? "") &&
        dominates(o, g),
    );
    if (dominatedBy) continue;
    nonDominated.push(g);
  }

  let candidatePool = nonDominated;
  if (special.length + nonDominated.length > MAX_CANDIDATES_PER_SLOT) {
    const budget = Math.max(0, MAX_CANDIDATES_PER_SLOT - special.length);
    // Top-K mit normalisierten Beitraegen statt roher Summe (Einheiten-mix vermeiden)
    candidatePool = nonDominated
      .map((g) => {
        const v = attrVector(g);
        const sum = Object.entries(v).reduce((acc, [k, val]) => {
          const max = GEAR_ATTR_TYPES[k as GearAttrKey]?.max ?? 0;
          return acc + (max > 0 ? (val / max) * 10 : 0);
        }, 0);
        return { g, sum };
      })
      .sort((a, b) => b.sum - a.sum)
      .slice(0, budget)
      .map((x) => x.g);
  }
  pool = [...special, ...candidatePool];
  return [...kept, ...pool];
}

function* cartesianBySlot(
  bySlot: Map<GearSlot, GearPiece[]>,
  lockedGear: GearPiece[] = [],
  warn?: (msg: string) => void,
): Generator<GearPiece[]> {
  const slotLists: GearPiece[][] = [];
  for (const slot of SLOTS) {
    const items = bySlot.get(slot) ?? [];
    if (items.length === 0) {
      slotLists.push([]);
      continue;
    }
    const pruned = pruneSlotCandidates(items, lockedGear);
    if (pruned.length < items.length && warn) {
      warn(`Slot ${slot}: ${items.length} Teile auf ${pruned.length} Kandidaten reduziert (Dominanz-Filter + Top-${MAX_CANDIDATES_PER_SLOT}).`);
    }
    slotLists.push(pruned);
  }
  const total = slotLists.reduce((acc, l) => acc * Math.max(1, l.length), 1);
  const FULL_LIMIT = 2_000_000;
  if (total > FULL_LIMIT) {
    slotLists.forEach((l, i) => {
      const lockedIds = new Set(lockedGear.map((g) => g.id));
      const kept = l.filter((g) => lockedIds.has(g.id));
      const free = l.filter((g) => !lockedIds.has(g.id));
      const keep = Math.max(1, Math.floor(Math.pow(FULL_LIMIT / Math.max(1, total), 1 / slotLists.length) * l.length));
      slotLists[i] = [...kept, ...free.slice(0, keep)];
    });
    if (warn) warn(`Suchraum zu groß (${total.toLocaleString("de-DE")} Kombinationen) — Kandidaten pro Slot begrenzt.`);
  }
  const n = slotLists.length;
  const indices = new Array(n).fill(0);
  if (slotLists.some((l) => l.length === 0)) return;
  while (true) {
    yield slotLists.map((l, i) => l[indices[i]]);
    let k = n - 1;
    while (k >= 0) {
      indices[k]++;
      if (indices[k] < slotLists[k].length) break;
      indices[k] = 0;
      k--;
    }
    if (k < 0) return;
  }
}
