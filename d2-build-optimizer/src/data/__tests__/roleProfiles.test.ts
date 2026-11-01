import { describe, it, expect } from "vitest";
import {
  GOALS,
  ROLE_PROFILES,
  roleProfile,
  checkAdmissibility,
  rankBuilds,
  normalizeAxes,
  compareBuilds,
  exoticAdmissible,
  allViolationsLabel,
  skillFitHint,
  type AdmissibilityCheckInput,
  type NormalizationSetInput,
} from "../roleProfiles";
import { computeEffectVector, type AxisContext, type SkillChoice } from "../axes";
import { SKILLS } from "../v4Data";
import type { GearPiece, GearSlot } from "../sampleData";

function gear(
  slot: GearSlot,
  core: "wd" | "armour" | "skill",
  brandType: GearPiece["brandType"] = "brand",
  attrs: Array<{ type: string; value: number }> = [],
  id?: string,
): GearPiece {
  return {
    id: id ?? `${slot}-${core}-${brandType}`,
    slot,
    brand: "Test",
    brandType,
    core,
    coreValue: core === "armour" ? 170000 : core === "skill" ? 1 : 15,
    attributes: attrs.map((a) => ({ type: a.type as never, value: a.value })),
    talent: null,
    prototype: true,
  };
}

function sixGear(
  core: "wd" | "armour" | "skill",
  opts: {
    brandType?: GearPiece["brandType"];
    chc?: number;
    status?: number;
    mix?: Array<"wd" | "armour" | "skill">;
  } = {},
): GearPiece[] {
  const slots: GearSlot[] = ["mask", "chest", "holster", "backpack", "gloves", "kneepads"];
  return slots.map((slot, i) => {
    const pieceCore = opts.mix ? opts.mix[i] : core;
    const attrs: Array<{ type: string; value: number }> = [];
    if (opts.chc && i === 0) attrs.push({ type: "chc", value: opts.chc });
    if (opts.status && i === 1) attrs.push({ type: "status", value: opts.status });
    return gear(slot, pieceCore, opts.brandType ?? "brand", attrs, `${slot}-${i}-${pieceCore}`);
  });
}

const hive: SkillChoice = {
  skill: SKILLS.find((s) => s.key === "hive")!,
  variant: SKILLS.find((s) => s.key === "hive")!.variants.find((v) => v.key === "restorer")!,
};

function ctx(overrides: Partial<AxisContext> = {}): AxisContext {
  return {
    weaponDps: 1_000_000,
    gear: sixGear("wd"),
    skills: [hive],
    teamSize: 4,
    threat: { statusShare: 0.3 },
    ...overrides,
  };
}

function checkInput(
  overrides: Partial<AdmissibilityCheckInput> = {},
): AdmissibilityCheckInput {
  return {
    gear: sixGear("wd"),
    vector: computeEffectVector(ctx()),
    role: roleProfile("dps_krit"),
    chc: 50,
    headshotShare: 0.3,
    statusAttr: 0,
    hasHealSkill: true,
    hasCcSkill: true,
    hasAggroTool: false,
    hasTeamArmorSource: false,
    hasTeamBuffSource: false,
    ...overrides,
  };
}

function candidate(
  id: string,
  vectorOverrides: Partial<Record<string, number>> = {},
  admissibleOverrides: Partial<NormalizationSetInput> = {},
): NormalizationSetInput {
  const base = computeEffectVector(ctx({ weaponDps: 800000 }));
  const vector = { ...base, ...vectorOverrides } as never;
  return {
    id,
    vector,
    admissible: true,
    violations: [],
    violationCount: 0,
    ...admissibleOverrides,
  };
}

describe("Ziele & Rollenprofile V4 (Issue #91, Lastenheft Abschnitt 3 und 5)", () => {
  it("vier Ziele, elf Rollen, jede Rolle gehört zu genau einem Ziel", () => {
    expect(GOALS).toHaveLength(4);
    expect(ROLE_PROFILES).toHaveLength(11);
    const roleKeys = new Set(ROLE_PROFILES.map((r) => r.key));
    for (const g of GOALS) {
      for (const r of g.roles) expect(roleKeys.has(r)).toBe(true);
    }
    const total = GOALS.reduce((s, g) => s + g.roles.length, 0);
    expect(total).toBe(ROLE_PROFILES.length);
  });

  it("Gewichte entsprechen der Lastenheft-Tabelle (Platzhalter, DPS Krit)", () => {
    const dpsKrit = roleProfile("dps_krit");
    expect(dpsKrit.weights.dps).toBe(1.0);
    expect(dpsKrit.weights.ehp).toBe(0.1);
    expect(dpsKrit.weights.skl).toBe(0);
    const heiler = roleProfile("skill_heiler");
    expect(heiler.weights).toEqual({ dps: 0.1, skl: 1.0, ehp: 0.3, cc: 0, buf: 0.3, upt: 0.5 });
  });

  it("Kriterium 8: Exotic-Limit — höchstens ein exotisches Ausrüstungsteil", () => {
    expect(exoticAdmissible(sixGear("wd"))).toBe(true);
    const oneExotic = sixGear("wd");
    oneExotic[0] = gear("mask", "wd", "exotic", [], "ex1");
    expect(exoticAdmissible(oneExotic)).toBe(true);
    const mixed = sixGear("wd");
    mixed[0] = gear("mask", "wd", "exotic", [], "ex1");
    mixed[1] = gear("chest", "wd", "exotic", [], "ex2");
    expect(exoticAdmissible(mixed)).toBe(false);
  });

  it("Kriterium 10: Mindestwerte schließen Builds aus, statt sie abzuwerten", () => {
    const result = checkAdmissibility(checkInput({ chc: 30 }));
    expect(result.admissible).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].label).toContain("CHC");
    const ok = checkAdmissibility(checkInput({ chc: 55 }));
    expect(ok.admissible).toBe(true);
  });

  it("Kriterium 9: Hybrid erfüllt immer die Kernverteilung seines Typs", () => {
    const role = roleProfile("hybrid_schaden_skill");
    const result = checkAdmissibility(
      checkInput({
        role,
        gear: sixGear("wd"),
      }),
    );
    expect(result.admissible).toBe(false);
    expect(result.violations[0].kind).toBe("core_distribution");
    const mixed = checkAdmissibility(
      checkInput({
        role,
        gear: sixGear("wd", { mix: ["wd", "wd", "wd", "skill", "skill", "skill"] }),
      }),
    );
    expect(mixed.admissible).toBe(true);
  });

  it("Kern-Mindestwerte: Skill-Heiler braucht ≥ 3 gelbe Kerne + Heil-Skill", () => {
    const role = roleProfile("skill_heiler");
    const fail = checkAdmissibility(
      checkInput({
        role,
        gear: sixGear("wd"),
        hasHealSkill: true,
        chc: 0,
        headshotShare: 0,
      }),
    );
    expect(fail.admissible).toBe(false);
    expect(fail.violations.some((v) => v.kind === "cores")).toBe(true);
    const pass = checkAdmissibility(
      checkInput({
        role,
        gear: sixGear("skill"),
        hasHealSkill: true,
        chc: 0,
        headshotShare: 0,
      }),
    );
    expect(pass.admissible).toBe(true);
    const noHeal = checkAdmissibility(
      checkInput({
        role,
        gear: sixGear("skill"),
        hasHealSkill: false,
        chc: 0,
        headshotShare: 0,
      }),
    );
    expect(noHeal.admissible).toBe(false);
    expect(noHeal.violations[0].kind).toBe("skill_selected");
  });

  it("Kriterium 12: Bestwert einer Achse 0 → Achse ist 0 für alle, kein Fehler", () => {
    const normalized = normalizeAxes([
      { dps: 100, skl: 0, ehp: 5, cc: 0, buf: 0, upt: 0 },
      { dps: 50, skl: 0, ehp: 10, cc: 0, buf: 0, upt: 0 },
    ]);
    expect(normalized[0].dps).toBe(100);
    expect(normalized[0].skl).toBe(0);
    expect(normalized[0].cc).toBe(0);
    expect(Number.isFinite(normalized[1].ehp)).toBe(true);
    expect(normalized[1].ehp).toBe(100);
  });

  it("Normierung auf das beste zulässige Build (0–100)", () => {
    const normalized = normalizeAxes([
      { dps: 500, skl: 0, ehp: 5, cc: 0, buf: 0, upt: 0.5 },
      { dps: 1000, skl: 0, ehp: 10, cc: 0, buf: 0, upt: 1 },
    ]);
    expect(normalized[0].dps).toBe(50);
    expect(normalized[0].upt).toBe(50);
    expect(normalized[1].dps).toBe(100);
  });

  it("Gleichstand: deterministische Tie-Breaks (größtes Gewicht zuerst, dann IDs)", () => {
    const role = roleProfile("dps_krit");
    const zero = { dps: 0, skl: 0, ehp: 0, cc: 0, buf: 0, upt: 0 };
    const mk = (id: string, dps: number) => ({
      id,
      vector: { dps, skl: 0, ehp: 5, cc: 0, buf: 0, upt: 0 } as never,
      admissible: true,
      violations: [],
      violationCount: 0,
      normalized: zero,
      score: 0,
      meetsTargetChc: true,
    });
    const a = mk("build-a", 500);
    const b = mk("build-b", 500);
    expect(compareBuilds(a, b, role)).toBe(-1);
    expect(compareBuilds(b, a, role)).toBe(1);
    const higherDps = mk("build-c", 600);
    expect(compareBuilds(higherDps, b, role)).toBeLessThan(0);
  });

  it("Kriterium 13: Kein zulässiges Build → Hinweis mit blockierendem Mindestwert", () => {
    const role = roleProfile("dps_krit");
    const result = rankBuilds(role, [
      candidate("a", {}, { admissible: false, violations: [{ kind: "chc", label: "CHC-Zielwert 50%", actual: 30, required: 50 }], violationCount: 1 }),
      candidate("b", {}, { admissible: false, violations: [{ kind: "chc", label: "CHC-Zielwert 50%", actual: 20, required: 50 }], violationCount: 1 }),
    ]);
    expect(result.bestAdmissible).toBeNull();
    expect(result.blockingMinimum?.label).toContain("CHC");
    const hint = allViolationsLabel(result);
    expect(hint).toContain("Kein zulässiges Build");
    expect(hint).toContain("CHC");
  });

  it("Zulässige Builds rangieren vor unzulässigen mit geringster Verletzung", () => {
    const role = roleProfile("dps_krit");
    const result = rankBuilds(role, [
      candidate("bad-2", {}, { admissible: false, violations: [
        { kind: "chc", label: "CHC-Zielwert 50%", actual: 30, required: 50 },
        { kind: "cores", label: "Kerne", actual: 0, required: 1 },
      ], violationCount: 2 }),
      candidate("good", {}, { admissible: true }),
      candidate("bad-1", {}, { admissible: false, violations: [{ kind: "chc", label: "CHC-Zielwert 50%", actual: 40, required: 50 }], violationCount: 1 }),
    ]);
    expect(result.ranked[0].id).toBe("good");
    expect(result.ranked[1].id).toBe("bad-1");
    expect(result.ranked[2].id).toBe("bad-2");
    expect(result.ranked.every((r, i, arr) => i === 0 || arr[i - 1].violationCount <= r.violationCount || !r.admissible)).toBe(true);
  });

  it("Skill-Hinweis: Heiler ohne Heil-Skill, Tank ohne Aggro-Werkzeug", () => {
    expect(skillFitHint(roleProfile("skill_heiler"), false, true)).toContain("Heil-Skill");
    expect(skillFitHint(roleProfile("skill_heiler"), true, false)).toBeNull();
    expect(skillFitHint(roleProfile("kontrolle"), true, false)).toContain("CC-Skill");
    expect(skillFitHint(roleProfile("tank"), false, false)).toBeNull();
  });

  it("CHC-Zielwert: nur bei Krit-relevanten Rollen, nicht bei Kopfschuss/CC", () => {
    expect(roleProfile("dps_krit").chcTarget).toBe(50);
    expect(roleProfile("dps_kopf").chcTarget).toBeNull();
    expect(roleProfile("kontrolle").chcTarget).toBeNull();
  });
});
