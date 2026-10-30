import type { GearPiece } from "./sampleData";
import {
  AXES,
  capValue,
  teamSizeFactor,
  GEAR_TALENTS,
  SPECIALIZATIONS,
  SKILL_SCALING,
  type AxisKey,
  type SkillEntry,
  type SkillVariant,
  type GearTalent,
} from "./v4Data";
import gearJson from "../db/gear.json";

interface GreenSetBonus {
  attr: string;
  val: number;
}

const greenSetInfo = (gearJson as unknown as {
  green_set_info: Record<string, { bonuses?: Record<string, GreenSetBonus[]> }>;
}).green_set_info;

const AXIS_ATTR_KEYS = new Set([
  "chc", "chd", "hsd", "wh", "armorregen", "explres", "hazard", "health",
  "skilldmg", "skillhaste", "repair", "status", "wd", "dta", "dth", "dttooc",
  "rof", "aok", "incomrepair",
]);

export function setBonusesForGear(gear: GearPiece[]): Array<{ attr: string; val: number; set: string; pieces: number }> {
  const counts = new Map<string, number>();
  for (const g of gear) {
    if (g.brandType !== "gearset") continue;
    const raw = g.brand.toLowerCase();
    const key =
      greenSetInfo[raw] !== undefined
        ? raw
        : Object.keys(greenSetInfo).find((k) => raw.startsWith(k) || k.startsWith(raw.split(" ")[0])) ?? raw;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out: Array<{ attr: string; val: number; set: string; pieces: number }> = [];
  for (const [key, count] of counts) {
    const tiers = greenSetInfo[key]?.bonuses ?? {};
    for (const [pieces, bonuses] of Object.entries(tiers)) {
      if (count < Number(pieces)) continue;
      for (const b of bonuses) {
        if (!AXIS_ATTR_KEYS.has(b.attr)) continue;
        out.push({ attr: b.attr, val: b.val, set: key, pieces: Number(pieces) });
      }
    }
  }
  return out;
}

function attrTotal(gear: GearPiece[], type: string): number {
  let sum = gear.reduce(
    (s, g) => s + g.attributes.filter((a) => a.type === type).reduce((x, a) => x + a.value, 0),
    0,
  );
  for (const b of setBonusesForGear(gear)) {
    if (b.attr === type) sum += b.val;
  }
  return sum;
}

export interface Assumption {
  key: string;
  label: string;
  value: number;
  source: string;
}

export interface ThreatProfile {
  statusShare: number;
  note?: string;
}

export interface SkillChoice {
  skill: SkillEntry;
  variant: SkillVariant;
}

export type SklKind = "damage" | "heal";

export const COMBAT_WINDOW_DEFAULT = 30;

const CC_EFFECT_WEIGHTS: Record<string, number> = {
  Festgesetzt: 1.0,
  Schock: 1.0,
  Interferenz: 0.9,
  Brennen: 0.7,
  Säure: 0.6,
  Geblendet: 0.5,
  Aggro: 0.4,
  Markiert: 0.2,
};

const MIN_CYCLE_SECONDS = 1;
const ASSUMED_BASE_VALUE_PER_TIER = 1000;
const ASSUMED_DAMAGE_KIND_SKILLDPS = "skilldmg";
const PROTECTION_TO_DPS_EQUIVALENCE = 0.01;

export interface AxisContext {
  weaponDps: number;
  gear: GearPiece[];
  skills: SkillChoice[];
  sklKind?: SklKind;
  teamSize: number;
  threat: ThreatProfile;
  combatWindowSeconds?: number;
  specializationKey?: string;
  userAssumptions?: Record<string, number>;
}

export interface AxisComputation {
  key: AxisKey;
  value: number;
  detail: Record<string, number | string | null>;
  assumptions: Assumption[];
}

export interface EffectVector {
  dps: number;
  skl: number;
  sklHeal: number;
  sklDamage: number;
  ehp: number;
  cc: number;
  buf: number;
  upt: number;
  computations: Record<AxisKey, AxisComputation>;
  assumptions: Assumption[];
}

function assumptionFor(
  ctx: AxisContext,
  key: string,
  _label: string,
  fallback: number,
  _source: string,
): number {
  const user = ctx.userAssumptions?.[key];
  if (typeof user === "number") return user;
  return fallback;
}

function registerAssumption(
  list: Assumption[],
  ctx: AxisContext,
  key: string,
  label: string,
  fallback: number,
  source: string,
): number {
  const value = assumptionFor(ctx, key, "", fallback, "");
  if (ctx.userAssumptions?.[key] === undefined) {
    list.push({ key, label, value, source });
  }
  return value;
}



function countCores(gear: GearPiece[], core: string): number {
  return gear.filter((g) => g.core === core).length;
}

function sumCoreValues(gear: GearPiece[], core: string): number {
  return gear.filter((g) => g.core === core).reduce((s, g) => s + g.coreValue, 0);
}

export function skillTierFor(
  gear: GearPiece[],
  specializationKey?: string,
): number {
  const technicianBonus =
    SPECIALIZATIONS.find((s) => s.key === "technician")?.skill_boni.find(
      (b) => b.wirkung === "Skill-Stufe",
    )?.wert ?? 0;
  const bonus = specializationKey === "technician" ? technicianBonus : 0;
  return capValue("skill_tier", countCores(gear, "skill") + bonus);
}

function rankMultiplier(variant: SkillVariant, tier: number): number {
  switch (variant.scaling_type) {
    case "damage":
      return 1 + (SKILL_SCALING.damage_per_rank * tier) / 100;
    case "repair":
      return 1 + (SKILL_SCALING.repair_per_rank * tier) / 100;
    case "cc_duration":
      return 1 + (SKILL_SCALING.cc_duration_per_rank * tier) / 100;
    case "shield_hp":
      return 1 + (SKILL_SCALING.shield_hp_per_rank * tier) / 100;
    default:
      return 1 + (SKILL_SCALING.damage_per_rank * tier) / 100;
  }
}

function baseValueFor(
  variant: SkillVariant,
  tier: number,
  ctx: AxisContext,
  assumptions: Assumption[],
): number {
  const multiplier = rankMultiplier(variant, tier);
  if (variant.base_value_per_tier !== null) return variant.base_value_per_tier * multiplier;
  const base = registerAssumption(
    assumptions,
    ctx,
    `skill.${variant.key}.base`,
    `Skill-Grundwert „${variant.name}“ (Annahme, Spiel offenbart Wert nicht; Rang-Multiplikator ${(multiplier * 100 - 100).toFixed(0)} %)`,
    ASSUMED_BASE_VALUE_PER_TIER,
    "skills.json: value_status = offen",
  );
  return base * multiplier;
}

function cycleSeconds(
  variant: SkillVariant,
  skillHaste: number,
  ctx: AxisContext,
  assumptions: Assumption[],
): number {
  let cycle =
    (variant.duration ?? 0) +
    (variant.cooldown ?? 0) * (1 - Math.min(0.9, skillHaste / 100));
  if (variant.duration === null || variant.cooldown === null) {
    cycle = registerAssumption(
      assumptions,
      ctx,
      `skill.${variant.key}.cycle`,
      `Zyklusdauer „${variant.name}“ (Annahme)`,
      Math.max(cycle, MIN_CYCLE_SECONDS),
      "skills.json: value_status = offen",
    );
  }
  return Math.max(cycle, MIN_CYCLE_SECONDS);
}

function computeSkl(
  ctx: AxisContext,
  assumptions: Assumption[],
): AxisComputation {
  const tier = skillTierFor(ctx.gear, ctx.specializationKey);
  const skillAttr = attrTotal(ctx.gear, "skilldmg");
  const repairAttr = attrTotal(ctx.gear, "repair");
  let sklDamage = 0;
  let sklHeal = 0;
  for (const choice of ctx.skills) {
    const variant = choice.variant;
    const base = baseValueFor(variant, tier, ctx, assumptions);
    const cycle = cycleSeconds(variant, attrTotal(ctx.gear, "skillhaste"), ctx, assumptions);
    if (variant.effect_type === "damage") {
      sklDamage += (base * (1 + skillAttr / 100)) / cycle;
    } else if (variant.effect_type === "heal") {
      sklHeal += (base * (1 + repairAttr / 100)) / cycle;
    }
  }
  const kind = ctx.sklKind ?? "damage";
  return {
    key: "skl",
    value: kind === "heal" ? sklHeal : sklDamage,
    detail: {
      tier,
      skillDamage: sklDamage,
      repair: sklHeal,
      kind,
    },
    assumptions,
  };
}

function computeEhp(
  ctx: AxisContext,
  assumptions: Assumption[],
): AxisComputation {
  const window = ctx.combatWindowSeconds ?? COMBAT_WINDOW_DEFAULT;
  const armor = sumCoreValues(ctx.gear, "armour");
  const health = attrTotal(ctx.gear, "health");
  const hazard = capValue("hazard", attrTotal(ctx.gear, "hazard"));
  const explres = capValue("explres", attrTotal(ctx.gear, "explres"));
  const threat = Math.max(0, Math.min(1, ctx.threat.statusShare));
  const damageReduction = (threat * hazard + (1 - threat) * explres) / 100;
  const regenAttr = attrTotal(ctx.gear, "armorregen");
  const regen = (regenAttr / 100) * armor * window;
  const ehp = (armor + health) / (1 - Math.min(0.9, damageReduction)) + regen;
  const usedAssumptions = [...assumptions];
  if (ctx.threat.statusShare < 0 || ctx.threat.statusShare > 1) {
    usedAssumptions.push({
      key: "threat.statusShare",
      label: "Bedrohungsprofil außerhalb 0–1, gedeckelt",
      value: threat,
      source: "Eingabe",
    });
  }
  return {
    key: "ehp",
    value: ehp,
    detail: {
      armor,
      health,
      hazard,
      explres,
      damageReduction,
      regeneration: regen,
      combatWindow: window,
    },
    assumptions: usedAssumptions,
  };
}

function computeCc(
  ctx: AxisContext,
  assumptions: Assumption[],
): AxisComputation {
  const statusAttr = attrTotal(ctx.gear, "status");
  const skillHaste = attrTotal(ctx.gear, "skillhaste");
  let cc = 0;
  for (const choice of ctx.skills) {
    const variant = choice.variant;
    if (variant.effect_type !== "cc" || !variant.status_effect) continue;
    const cycle = cycleSeconds(variant, skillHaste, ctx, assumptions);
    const rankFactor = rankMultiplier(variant, skillTierFor(ctx.gear, ctx.specializationKey));
    const rawUptime =
      ((variant.duration ?? 0) * rankFactor * (1 + statusAttr / 100)) / cycle;
    const uptime = Math.min(1, Math.max(0, rawUptime));
    const weight = CC_EFFECT_WEIGHTS[variant.status_effect] ?? 0.5;
    cc += uptime * weight;
  }
  return {
    key: "cc",
    value: Math.min(1, cc),
    detail: {
      statusAttribute: statusAttr,
      effects: ctx.skills
        .filter((s) => s.variant.effect_type === "cc")
        .map((s) => s.variant.status_effect)
        .join(", ") || null,
    },
    assumptions,
  };
}

export interface ActiveBuff {
  talent: GearTalent;
  contribution: number;
}

function isDamageEffect(wirkung: string): boolean {
  return /schaden|CHC|CHD|DPS/i.test(wirkung);
}

export function buffsFor(
  talentKeys: string[],
  ctx: AxisContext,
  assumptions: Assumption[] = [],
): ActiveBuff[] {
  const active: ActiveBuff[] = [];
  for (const key of talentKeys) {
    const talent = GEAR_TALENTS.find((t) => t.key === key);
    if (!talent || talent.wert === null) continue;
    let uptime = talent.uptime;
    if (ctx.userAssumptions?.[`talent.${key}.uptime`] === undefined) {
      assumptions.push({
        key: `talent.${key}.uptime`,
        label: `Aktivzeit „${talent.name}“ (Annahme)`,
        value: talent.uptime,
        source: "talent.json",
      });
    } else {
      uptime = ctx.userAssumptions[`talent.${key}.uptime`];
    }
    if (uptime <= 0) continue;
    const factor = teamSizeFactor(talent.ziel, ctx.teamSize);
    if (factor <= 0) continue;
    const magnitude = talent.wert * uptime * factor;
    if (isDamageEffect(talent.wirkung)) {
      active.push({ talent, contribution: (ctx.weaponDps * magnitude) / 100 });
    } else {
      active.push({
        talent,
        contribution: (magnitude * PROTECTION_TO_DPS_EQUIVALENCE * ctx.weaponDps) / 100,
      });
    }
  }
  return active;
}

function computeBuf(
  talentKeys: string[],
  ctx: AxisContext,
  assumptions: Assumption[],
): AxisComputation {
  const buffs = buffsFor(talentKeys, ctx, assumptions);
  const spec = SPECIALIZATIONS.find((s) => s.key === ctx.specializationKey);
  let value = buffs.reduce((sum, b) => sum + b.contribution, 0);
  const specBuffs: string[] = [];
  if (spec) {
    for (const buff of spec.team_buffs) {
      if (buff.target !== "team" && buff.target !== "team_ohne_mich") continue;
      if (buff.wert === null) continue;
      const factor = teamSizeFactor(buff.target, ctx.teamSize);
      const uptime = buff.uptime ?? 1;
      if (factor <= 0 || uptime <= 0) continue;
      value += (ctx.weaponDps * buff.wert * uptime * factor) / 100;
      specBuffs.push(buff.name);
    }
  }
  return {
    key: "buf",
    value,
    detail: {
      talentCount: buffs.length,
      talentNames: buffs.map((b) => b.talent.name).join(", ") || null,
      specBuffs: specBuffs.join(", ") || null,
      teamSize: ctx.teamSize,
    },
    assumptions,
  };
}

function computeUpt(
  ctx: AxisContext,
  assumptions: Assumption[],
): AxisComputation {
  const skillHaste = attrTotal(ctx.gear, "skillhaste");
  const window = ctx.combatWindowSeconds ?? COMBAT_WINDOW_DEFAULT;
  if (ctx.skills.length === 0) {
    return { key: "upt", value: 0, detail: { skills: 0 }, assumptions };
  }
  let readiness = 0;
  for (const choice of ctx.skills) {
    const variant = choice.variant;
    const cycle = cycleSeconds(variant, skillHaste, ctx, assumptions);
    if ((variant.duration ?? 0) > 0) {
      readiness += Math.min(1, (variant.duration ?? 0) / cycle);
    } else {
      readiness += Math.max(0, Math.min(1, 1 - cycle / window));
    }
  }
  return {
    key: "upt",
    value: readiness / ctx.skills.length,
    detail: { skillHaste, combatWindow: window, skills: ctx.skills.length },
    assumptions,
  };
}

export function computeEffectVector(
  ctx: AxisContext,
  talentKeys: string[] = [],
): EffectVector {
  const sklAssumptions: Assumption[] = [];
  const ehpAssumptions: Assumption[] = [];
  const ccAssumptions: Assumption[] = [];
  const bufAssumptions: Assumption[] = [];
  const uptAssumptions: Assumption[] = [];

  const skl = computeSkl(ctx, sklAssumptions);
  const ehp = computeEhp(ctx, ehpAssumptions);
  const cc = computeCc(ctx, ccAssumptions);
  const buf = computeBuf(talentKeys, ctx, bufAssumptions);
  const upt = computeUpt(ctx, uptAssumptions);

  const computations: Record<AxisKey, AxisComputation> = {
    dps: {
      key: "dps",
      value: ctx.weaponDps,
      detail: { source: "bestehende Schadens-Engine (computeDamage)" },
      assumptions: [],
    },
    skl,
    ehp,
    cc,
    buf,
    upt,
  };

  const assumptions = [
    ...sklAssumptions,
    ...ehpAssumptions,
    ...ccAssumptions,
    ...bufAssumptions,
    ...uptAssumptions,
  ];

  return {
    dps: ctx.weaponDps,
    skl: skl.value,
    sklHeal: skl.detail.repair as number,
    sklDamage: skl.detail.skillDamage as number,
    ehp: ehp.value,
    cc: cc.value,
    buf: buf.value,
    upt: upt.value,
    computations,
    assumptions,
  };
}

export function vectorToRecord(v: EffectVector): Record<AxisKey, number> {
  return {
    dps: v.dps,
    skl: v.skl,
    ehp: v.ehp,
    cc: v.cc,
    buf: v.buf,
    upt: v.upt,
  };
}

export const ALL_AXES = AXES;
export { ASSUMED_DAMAGE_KIND_SKILLDPS };
