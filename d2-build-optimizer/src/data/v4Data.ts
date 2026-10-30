import skillsJson from "../db/skills.json";
import specializationsJson from "../db/specializations.json";
import attributeRulesJson from "../db/attribute-rules.json";
import sourcesJson from "../db/sources.json";
import talentsJson from "../db/talent.json";

export type AxisKey = "dps" | "skl" | "ehp" | "cc" | "buf" | "upt";

export const AXES: AxisKey[] = ["dps", "skl", "ehp", "cc", "buf", "upt"];

export type BuffTarget = "self" | "team" | "team_ohne_mich";

export type ValueStatus = "bestätigt" | "Annahme" | "offen";

export interface SkillVariant {
  key: string;
  name: string;
  effect_type: "damage" | "heal" | "cc" | "buff" | "defense";
  damage_kind: string | null;
  status_effect: string | null;
  base_value_per_tier: number | null;
  value_unit: string | null;
  value_status: ValueStatus;
  duration: number | null;
  cooldown: number | null;
  charges: number | null;
  description: string;
  scaling_type?: "damage" | "repair" | "cc_duration" | "shield_hp";
}

export interface SkillScalingRules {
  damage_per_rank: number;
  repair_per_rank: number;
  cc_duration_per_rank: number;
  shield_hp_per_rank: number;
  overcharge: { duration: number; note: string };
}

export const SKILL_SCALING: SkillScalingRules = (skillsJson as unknown as {
  scaling_rules: SkillScalingRules;
}).scaling_rules;

export interface ImmunityThresholds {
  shock: number;
  poison: number;
  blind_deaf: number;
  bleed: number;
  burn: number;
  disorient: number;
  disrupt: number;
  ensnare: number;
}

export const IMMUNITY_THRESHOLDS: ImmunityThresholds = (attributeRulesJson as unknown as {
  immunity_thresholds: ImmunityThresholds;
}).immunity_thresholds;

export interface SkillEntry {
  key: string;
  name: string;
  variants: SkillVariant[];
}

export interface SpecBuff {
  name: string;
  target?: BuffTarget;
  wirkung: string;
  wert: number | null;
  unit?: string;
  ausloeser?: string;
  bedingung?: string | null;
  uptime?: number;
  stapel?: string | null;
  value_status: ValueStatus;
  hint?: string;
}

export interface SpecializationEntry {
  key: string;
  name: string;
  signature_weapon: string;
  focus: string[];
  passive_boni: Array<{
    wirkung: string;
    wert: number | null;
    unit?: string;
    beschreibung?: string;
    value_status: ValueStatus;
  }>;
  signature_grenade: string;
  skill_boni: SpecBuff[];
  team_buffs: SpecBuff[];
  team_side_effects: Array<{
    wirkung: string;
    beschreibung: string;
    wert?: number | null;
    value_status?: ValueStatus;
  }>;
  axis_relevance: Record<AxisKey, number>;
}

export interface GearTalent {
  key: string;
  name: string;
  slot: string[];
  ziel: BuffTarget;
  wirkung: string;
  wert: number | null;
  unit: string | null;
  ausloeser: string;
  bedingung: string | null;
  uptime: number;
  stapel: string | null;
  team_wirkung: boolean;
  category: string;
  value_status: ValueStatus;
  description: string;
}

export interface HardCap {
  attr: string;
  name: string;
  cap: number;
  unit: string;
  value_status: ValueStatus;
  source: string;
}

export interface AttributeRule {
  slot: string;
  cores: string[];
  attributes: string[];
  mods: number;
  hint?: string;
}

export interface ValueRange {
  min: number;
  max: number;
  unit: string;
}

export interface SourceEntry {
  key: string;
  item: string;
  source_type: "targeted_farm" | "random_drop" | "quest" | "vendor";
  game_activity: string[];
  stage: "A" | "B";
  value_status: ValueStatus;
}

const skillsDb = skillsJson as {
  version: string;
  game_version: string;
  data_stand: string;
  skills: SkillEntry[];
};

const specializationsDb = specializationsJson as {
  version: string;
  game_version: string;
  data_stand: string;
  specializations: SpecializationEntry[];
};

const attributeRulesDb = attributeRulesJson as unknown as {
  version: string;
  game_version: string;
  data_stand: string;
  hard_caps: HardCap[];
  no_hard_cap: Array<{ attr: string; name: string; note: string; value_status: ValueStatus }>;
  chc_target: {
    default: number;
    max: number;
    player_input: boolean;
    roles_relevant: string[];
    roles_irrelevant: string[];
    note: string;
  };
  slot_rules: AttributeRule[];
  value_ranges: Record<string, ValueRange | { _note: string }>;
};

const sourcesDb = sourcesJson as {
  version: string;
  game_version: string;
  data_stand: string;
  sources: SourceEntry[];
};

const talentsDb = talentsJson as {
  version: string;
  gear_talents: GearTalent[];
};

export const SKILLS: SkillEntry[] = skillsDb.skills;
export const SPECIALIZATIONS: SpecializationEntry[] =
  specializationsDb.specializations;
export const HARD_CAPS: HardCap[] = attributeRulesDb.hard_caps;
export const SLOT_RULES: AttributeRule[] = attributeRulesDb.slot_rules;
export const VALUE_RANGES: Record<string, ValueRange> = Object.fromEntries(
  Object.entries(attributeRulesDb.value_ranges).filter(
    (entry): entry is [string, ValueRange] =>
      typeof (entry[1] as ValueRange).min === "number",
  ),
);
export const CHC_TARGET = attributeRulesDb.chc_target;
export const GEAR_TALENTS: GearTalent[] = talentsDb.gear_talents;
export const SOURCES: SourceEntry[] = sourcesDb.sources;

export const DATA_VERSION_V4 = {
  skills: skillsDb.version,
  specializations: specializationsDb.version,
  attributeRules: attributeRulesDb.version,
  sources: sourcesDb.version,
  talents: talentsDb.version,
  gameVersion: skillsDb.game_version,
  dataStand: skillsDb.data_stand,
};

const VALID_TARGETS: BuffTarget[] = ["self", "team", "team_ohne_mich"];

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`V4-Datenfehler: ${message}`);
  }
}

for (const spec of SPECIALIZATIONS) {
  for (const buff of [...spec.team_buffs, ...spec.skill_boni]) {
    if (buff.target !== undefined) {
      assert(
        VALID_TARGETS.includes(buff.target),
        `specializations.json: unbekanntes Ziel '${buff.target}' bei '${buff.name}' (${spec.key})`,
      );
    }
  }
  for (const axis of AXES) {
    assert(
      axis in spec.axis_relevance,
      `specializations.json: Achse '${axis}' fehlt in axis_relevance von '${spec.key}'`,
    );
  }
}

for (const talent of GEAR_TALENTS) {
  assert(
    VALID_TARGETS.includes(talent.ziel),
    `talent.json: unbekanntes Ziel '${talent.ziel}' bei '${talent.key}'`,
  );
  assert(
    talent.uptime >= 0 && talent.uptime <= 1,
    `talent.json: Uptime außerhalb 0–1 bei '${talent.key}'`,
  );
}

for (const skill of SKILLS) {
  assert(skill.variants.length > 0, `skills.json: keine Variante bei '${skill.key}'`);
  for (const variant of skill.variants) {
    assert(
      ["damage", "heal", "cc", "buff", "defense"].includes(variant.effect_type),
      `skills.json: unbekannter effect_type bei '${skill.key}/${variant.key}'`,
    );
  }
}

for (const source of SOURCES) {
  assert(
    source.stage === "A" || source.stage === "B",
    `sources.json: ungültige Stufe bei '${source.key}'`,
  );
}

export function capValue(attr: string, value: number): number {
  const cap = HARD_CAPS.find((c) => c.attr === attr);
  return cap ? Math.min(value, cap.cap) : value;
}

export function teamSizeFactor(target: BuffTarget, teamSize: number): number {
  if (target === "team") return teamSize;
  if (target === "team_ohne_mich") return Math.max(0, teamSize - 1);
  return 1;
}
