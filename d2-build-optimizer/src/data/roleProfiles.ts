import type { GearPiece } from "./sampleData";
import { AXES, CHC_TARGET, capValue, type AxisKey, type BuffTarget } from "./v4Data";
import type { EffectVector } from "./axes";

export type ZielKey = "dps" | "skill_support" | "armor_support" | "hybrid";

export interface CoreRequirement {
  core: "wd" | "armour" | "skill";
  min: number;
}

export type MinimumKind =
  | { kind: "cores"; core: "wd" | "armour" | "skill"; min: number }
  | { kind: "chc"; min: number }
  | { kind: "skill_selected"; effectType: "heal" | "damage" | "cc" }
  | { kind: "team_armor_source"; }
  | { kind: "aggro_tool"; }
  | { kind: "team_buff_source"; }
  | { kind: "status_threshold"; min: number }
  | { kind: "core_distribution"; wd?: number; armour?: number; skill?: number }
  | { kind: "headshot_share"; min: number };

export interface RoleProfile {
  key: string;
  ziel: ZielKey;
  name: string;
  weights: Record<AxisKey, number>;
  sklKind: "damage" | "heal";
  minima: MinimumKind[];
  chcTarget: number | null;
  skillHint: string | null;
}

export interface Goal {
  key: ZielKey;
  name: string;
  roles: string[];
}

export const GOALS: Goal[] = [
  { key: "dps", name: "DPS", roles: ["dps_krit", "dps_kopf"] },
  { key: "skill_support", name: "Skill-Support", roles: ["skill_heiler", "skill_schaden", "kontrolle"] },
  { key: "armor_support", name: "Rüstungs-Support", roles: ["ruestungs_supporter", "tank", "buffer"] },
  { key: "hybrid", name: "Hybrid", roles: ["hybrid_schaden_skill", "hybrid_schaden_tank", "hybrid_skill_tank"] },
];

function w(
  dps: number,
  skl: number,
  ehp: number,
  cc: number,
  buf: number,
  upt: number,
): Record<AxisKey, number> {
  return { dps, skl, ehp, cc, buf, upt };
}

export const ROLE_PROFILES: RoleProfile[] = [
  {
    key: "dps_krit",
    ziel: "dps",
    name: "DPS Krit",
    weights: w(1.0, 0, 0.1, 0, 0, 0),
    sklKind: "damage",
    minima: [{ kind: "chc", min: CHC_TARGET.default }],
    chcTarget: CHC_TARGET.default,
    skillHint: null,
  },
  {
    key: "dps_kopf",
    ziel: "dps",
    name: "DPS Kopfschuss",
    weights: w(1.0, 0, 0.1, 0, 0, 0),
    sklKind: "damage",
    minima: [{ kind: "headshot_share", min: 0 }],
    chcTarget: null,
    skillHint: null,
  },
  {
    key: "skill_heiler",
    ziel: "skill_support",
    name: "Skill-Heiler",
    weights: w(0.1, 1.0, 0.3, 0, 0.3, 0.5),
    sklKind: "heal",
    minima: [
      { kind: "cores", core: "skill", min: 3 },
      { kind: "skill_selected", effectType: "heal" },
    ],
    chcTarget: null,
    skillHint: "Kein Heil-Skill gewählt — Rolle erwartet einen Heil-Skill (z. B. Heilbrut oder Heilmine).",
  },
  {
    key: "skill_schaden",
    ziel: "skill_support",
    name: "Skill-Schaden",
    weights: w(0.2, 1.0, 0.2, 0.3, 0, 0.5),
    sklKind: "damage",
    minima: [{ kind: "cores", core: "skill", min: 4 }],
    chcTarget: null,
    skillHint: null,
  },
  {
    key: "kontrolle",
    ziel: "skill_support",
    name: "Kontrolle (CC)",
    weights: w(0.2, 0.3, 0.3, 1.0, 0, 0.5),
    sklKind: "damage",
    minima: [{ kind: "status_threshold", min: 0 }],
    chcTarget: null,
    skillHint: "Kein CC-Skill gewählt — Rolle erwartet einen Statuseffekt-Skill (z. B. Aufruhrschaum, Blender).",
  },
  {
    key: "ruestungs_supporter",
    ziel: "armor_support",
    name: "Rüstungs-Supporter",
    weights: w(0.1, 0.2, 1.0, 0, 0.6, 0.2),
    sklKind: "heal",
    minima: [
      { kind: "cores", core: "armour", min: 4 },
      { kind: "team_armor_source" },
    ],
    chcTarget: null,
    skillHint: null,
  },
  {
    key: "tank",
    ziel: "armor_support",
    name: "Tank",
    weights: w(0.2, 0, 1.0, 0.2, 0.3, 0.2),
    sklKind: "damage",
    minima: [
      { kind: "cores", core: "armour", min: 5 },
      { kind: "aggro_tool" },
    ],
    chcTarget: null,
    skillHint: "Kein Aggro-Werkzeug gewählt — Rolle erwartet Schild oder Köder.",
  },
  {
    key: "buffer",
    ziel: "armor_support",
    name: "Buffer",
    weights: w(0.3, 0, 0.3, 0, 1.0, 0.3),
    sklKind: "damage",
    minima: [{ kind: "team_buff_source" }],
    chcTarget: null,
    skillHint: null,
  },
  {
    key: "hybrid_schaden_skill",
    ziel: "hybrid",
    name: "Hybrid Schaden/Skill",
    weights: w(0.7, 0.7, 0.2, 0, 0, 0.4),
    sklKind: "damage",
    minima: [{ kind: "core_distribution", wd: 3, skill: 3 }],
    chcTarget: CHC_TARGET.default,
    skillHint: null,
  },
  {
    key: "hybrid_schaden_tank",
    ziel: "hybrid",
    name: "Hybrid Schaden/Tank",
    weights: w(0.7, 0, 0.7, 0, 0, 0.2),
    sklKind: "damage",
    minima: [{ kind: "core_distribution", wd: 3, armour: 3 }],
    chcTarget: CHC_TARGET.default,
    skillHint: null,
  },
  {
    key: "hybrid_skill_tank",
    ziel: "hybrid",
    name: "Hybrid Skill/Tank",
    weights: w(0.1, 0.7, 0.7, 0, 0, 0.4),
    sklKind: "heal",
    minima: [{ kind: "core_distribution", skill: 3, armour: 3 }],
    chcTarget: null,
    skillHint: null,
  },
];

export function roleProfile(key: string): RoleProfile {
  return ROLE_PROFILES.find((r) => r.key === key) ?? ROLE_PROFILES[0];
}

export interface AdmissibilityCheckInput {
  gear: GearPiece[];
  vector: EffectVector;
  role: RoleProfile;
  chc: number;
  headshotShare: number;
  statusAttr: number;
  hasHealSkill: boolean;
  hasCcSkill: boolean;
  hasAggroTool: boolean;
  hasTeamArmorSource: boolean;
  hasTeamBuffSource: boolean;
}

export interface MinimumViolation {
  kind: MinimumKind["kind"];
  label: string;
  actual: number | null;
  required: number | null;
}

export interface AdmissibilityResult {
  admissible: boolean;
  violations: MinimumViolation[];
}

function countCores(gear: GearPiece[], core: string): number {
  return gear.filter((g) => g.core === core).length;
}

const TEAM_ARMOR_TALENTS = ["galvanize", "future_initiative_chest", "future_initiative_backpack"];
const TEAM_BUFF_TALENTS = ["overwatch", "coyote_mask"];
const AGGRO_SKILLS = new Set(["shield", "decoy"]);

export function checkAdmissibility(
  input: AdmissibilityCheckInput,
): AdmissibilityResult {
  const violations: MinimumViolation[] = [];
  for (const m of input.role.minima) {
    switch (m.kind) {
      case "cores": {
        const actual = countCores(input.gear, m.core);
        if (actual < m.min) {
          violations.push({
            kind: "cores",
            label: `Mindestens ${m.min} ${m.core === "skill" ? "gelbe" : m.core === "armour" ? "blaue" : "rote"} Kerne`,
            actual,
            required: m.min,
          });
        }
        break;
      }
      case "chc": {
        const capped = capValue("chc", input.chc);
        if (capped < m.min) {
          violations.push({
            kind: "chc",
            label: `CHC-Zielwert ${m.min}%`,
            actual: capped,
            required: m.min,
          });
        }
        break;
      }
      case "skill_selected": {
        const ok = m.effectType === "heal" ? input.hasHealSkill : input.hasCcSkill;
        if (!ok) {
          violations.push({
            kind: "skill_selected",
            label: m.effectType === "heal" ? "Heil-Skill gewählt" : "CC-Skill gewählt",
            actual: null,
            required: null,
          });
        }
        break;
      }
      case "team_armor_source": {
        if (!input.hasTeamArmorSource) {
          violations.push({
            kind: "team_armor_source",
            label: "Team-Rüstungsquelle aktiv",
            actual: null,
            required: null,
          });
        }
        break;
      }
      case "aggro_tool": {
        if (!input.hasAggroTool) {
          violations.push({
            kind: "aggro_tool",
            label: "Aggro-Werkzeug (Schild oder Köder)",
            actual: null,
            required: null,
          });
        }
        break;
      }
      case "team_buff_source": {
        if (!input.hasTeamBuffSource) {
          violations.push({
            kind: "team_buff_source",
            label: "Team-Buff-Quelle aktiv",
            actual: null,
            required: null,
          });
        }
        break;
      }
      case "status_threshold": {
        if (input.statusAttr < m.min) {
          violations.push({
            kind: "status_threshold",
            label: `Statuseffekte ≥ ${m.min}%`,
            actual: input.statusAttr,
            required: m.min,
          });
        }
        break;
      }
      case "core_distribution": {
        const wd = m.wd ? countCores(input.gear, "wd") : null;
        const armour = m.armour ? countCores(input.gear, "armour") : null;
        const skill = m.skill ? countCores(input.gear, "skill") : null;
        const okWd = m.wd === undefined || wd !== null && wd >= m.wd;
        const okArmour = m.armour === undefined || armour !== null && armour >= m.armour;
        const okSkill = m.skill === undefined || skill !== null && skill >= m.skill;
        if (!(okWd && okArmour && okSkill)) {
          violations.push({
            kind: "core_distribution",
            label: `Kernverteilung ${m.wd ?? 0} rot / ${m.skill ?? 0} gelb / ${m.armour ?? 0} blau`,
            actual: wd,
            required: m.wd ?? null,
          });
        }
        break;
      }
      case "headshot_share": {
        if (input.headshotShare <= m.min) {
          violations.push({
            kind: "headshot_share",
            label: "Kopfschuss-Anteil im Gegnerprofil > 0",
            actual: input.headshotShare,
            required: m.min,
          });
        }
        break;
      }
    }
  }
  return { admissible: violations.length === 0, violations };
}

export interface ScoredBuild {
  id: string;
  vector: EffectVector;
  admissible: boolean;
  violations: MinimumViolation[];
  normalized: Record<AxisKey, number>;
  score: number;
  violationCount: number;
  meetsTargetChc: boolean;
}

export interface NormalizationSetInput {
  id: string;
  vector: EffectVector;
  admissible: boolean;
  violations: MinimumViolation[];
  violationCount: number;
  meetsTargetChc?: boolean;
}

export interface NormalizeOptions {
  role: RoleProfile;
  builds: NormalizationSetInput[];
}

export function normalizeAxes(
  vectors: Record<AxisKey, number>[],
): Record<AxisKey, number>[] {
  const best: Record<AxisKey, number> = {
    dps: 0, skl: 0, ehp: 0, cc: 0, buf: 0, upt: 0,
  };
  for (const v of vectors) {
    for (const axis of AXES) {
      if (v[axis] > best[axis]) best[axis] = v[axis];
    }
  }
  return vectors.map((v) => {
    const out: Record<AxisKey, number> = {
      dps: 0, skl: 0, ehp: 0, cc: 0, buf: 0, upt: 0,
    };
    for (const axis of AXES) {
      out[axis] = best[axis] > 0 ? (100 * v[axis]) / best[axis] : 0;
    }
    return out;
  });
}

export function scoreBuild(
  role: RoleProfile,
  normalized: Record<AxisKey, number>,
): number {
  let score = 0;
  for (const axis of AXES) {
    score += role.weights[axis] * normalized[axis];
  }
  return score;
}

export function compareBuilds(
  a: ScoredBuild,
  b: ScoredBuild,
  role: RoleProfile,
): number {
  if (a.admissible !== b.admissible) return a.admissible ? -1 : 1;
  if (a.meetsTargetChc !== b.meetsTargetChc) return a.meetsTargetChc ? -1 : 1;
  if (a.violationCount !== b.violationCount) return a.violationCount - b.violationCount;
  if (a.score !== b.score) return b.score - a.score;
  const ordered = [...AXES].sort((x, y) => role.weights[y] - role.weights[x]);
  for (const axis of ordered) {
    if (a.vector[axis] !== b.vector[axis]) return b.vector[axis] - a.vector[axis];
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface RankingResult {
  ranked: ScoredBuild[];
  bestAdmissible: ScoredBuild | null;
  blockingMinimum: MinimumViolation | null;
}

export function rankBuilds(
  role: RoleProfile,
  candidates: NormalizationSetInput[],
): RankingResult {
  const admissibleVectors = candidates
    .filter((c) => c.admissible)
    .map((c) => axisRecord(c.vector));
  const admissibleNormalized = normalizeAxes(admissibleVectors);
  const admissibleById = new Map(
    candidates.filter((c) => c.admissible).map((c, i) => [c.id, admissibleNormalized[i]]),
  );
  const allVectors = candidates.map((c) => axisRecord(c.vector));
  const allNormalized = normalizeAxes(allVectors);
  const byId = new Map(candidates.map((c, i) => [c.id, allNormalized[i]]));

  const scored: ScoredBuild[] = candidates.map((c) => {
    const normalized = c.admissible
      ? admissibleById.get(c.id) ?? zeroNormalized()
      : byId.get(c.id) ?? zeroNormalized();
    return {
      id: c.id,
      vector: c.vector,
      admissible: c.admissible,
      violations: c.violations,
      normalized,
      score: scoreBuild(role, normalized),
      violationCount: c.violationCount,
      meetsTargetChc: c.meetsTargetChc ?? false,
    };
  });

  scored.sort((a, b) => compareBuilds(a, b, role));

  const bestAdmissible = scored.find((b) => b.admissible) ?? null;
  const violationCounts = new Map<string, number>();
  for (const c of candidates) {
    for (const v of c.violations) {
      violationCounts.set(v.label, (violationCounts.get(v.label) ?? 0) + 1);
    }
  }
  let blockingMinimum: MinimumViolation | null = null;
  let maxCount = 0;
  for (const c of candidates) {
    for (const v of c.violations) {
      const count = violationCounts.get(v.label) ?? 0;
      if (count > maxCount) {
        maxCount = count;
        blockingMinimum = v;
      }
    }
  }

  return { ranked: scored, bestAdmissible, blockingMinimum };
}

function axisRecord(v: EffectVector): Record<AxisKey, number> {
  return { dps: v.dps, skl: v.skl, ehp: v.ehp, cc: v.cc, buf: v.buf, upt: v.upt };
}

function zeroNormalized(): Record<AxisKey, number> {
  return { dps: 0, skl: 0, ehp: 0, cc: 0, buf: 0, upt: 0 };
}

export function exoticCount(gear: GearPiece[]): number {
  return gear.filter((g) => g.brandType === "exotic").length;
}

export function exoticAdmissible(gear: GearPiece[]): boolean {
  return exoticCount(gear) <= 1;
}

export function allViolationsLabel(result: RankingResult): string | null {
  if (result.bestAdmissible) return null;
  const b = result.blockingMinimum;
  if (!b) return "Kein zulässiges Build gefunden.";
  return `Kein zulässiges Build — am häufigsten blockiert: „${b.label}“. Vorschlag: Mindestwert lockern (aktuell ${b.required ?? "—"}).`;
}

export function skillFitHint(role: RoleProfile, hasHealSkill: boolean, hasCcSkill: boolean): string | null {
  if (!role.skillHint) return null;
  if (role.sklKind === "heal" && !hasHealSkill) return role.skillHint;
  if (role.key === "kontrolle" && !hasCcSkill) return role.skillHint;
  if (role.key === "tank") return null;
  return null;
}

export { TEAM_ARMOR_TALENTS, TEAM_BUFF_TALENTS, AGGRO_SKILLS };
export type { BuffTarget };
