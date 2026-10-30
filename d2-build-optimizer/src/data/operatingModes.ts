import type { Weapon, GearPiece, GearSlot } from "./sampleData";
import type { OptimizationSettings } from "../store";
import { optimizeBuilds } from "./damage";
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
  talentKeys?: string[];
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

function chcAttrOf(gear: GearPiece[]): number {
  return gear.reduce(
    (sum, g) =>
      sum + g.attributes.filter((a) => a.type === "chc").reduce((s, a) => s + a.value, 0),
    0,
  );
}

export function axisContextFor(
  gear: GearPiece[],
  weaponDps: number,
  ctx: ModeContext,
  role: RoleProfile,
): AxisContext {
  return {
    weaponDps,
    gear,
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
  return {
    gear,
    vector,
    role,
    chc: chcAttrOf(gear),
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
  const role = ROLE_KEY_SET.has(roleKey) ? roleProfile(roleKey) : null;
  if (!role) return GOALS[0].name;
  return GOALS.find((g) => g.key === role.ziel)?.name ?? GOALS[0].name;
}

const ROLE_KEY_SET = new Set<string>([]);

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
      if (exoticAdmissible([g])) fit += 0;
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
      setBonusCatalog: opts.setBonusCatalog as never,
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

export interface ReachabilityResult {
  mode: OperatingMode;
  inventarScore: number | null;
  zielScore: number | null;
  reachabilityPercent: number | null;
  targetIsUpperBound: boolean;
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

export const V4_ALL_SLOTS = SLOTS;
export { SKILLS };
