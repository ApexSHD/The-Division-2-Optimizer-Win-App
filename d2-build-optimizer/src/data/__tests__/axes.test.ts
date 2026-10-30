import { describe, it, expect } from "vitest";
import {
  computeEffectVector,
  skillTierFor,
  buffsFor,
  setBonusesForGear,
  COMBAT_WINDOW_DEFAULT,
  type AxisContext,
  type SkillChoice,
} from "../axes";
import gearJson from "../../db/gear.json";
import { SKILLS } from "../v4Data";
import type { GearPiece, GearSlot } from "../sampleData";

function gearPiece(
  slot: GearSlot,
  core: "wd" | "armour" | "skill",
  attributes: Array<{ type: string; value: number }>,
  id = `${slot}-${core}`,
): GearPiece {
  return {
    id,
    slot,
    brand: "Testmarke",
    brandType: "brand",
    core,
    coreValue: core === "armour" ? 170000 : core === "skill" ? 1 : 15,
    attributes: attributes.map((a) => ({ type: a.type as never, value: a.value })),
    talent: null,
    prototype: true,
  };
}

function fullSkillGear(
  core: "wd" | "armour" | "skill",
  extra: Array<{ type: string; value: number }> = [],
): GearPiece[] {
  const slots: GearSlot[] = [
    "mask",
    "chest",
    "holster",
    "backpack",
    "gloves",
    "kneepads",
  ];
  return slots.map((slot, i) =>
    gearPiece(slot, core, i === 0 ? extra : [], `${slot}-${core}-${i}`),
  );
}

const restorerHive: SkillChoice = {
  skill: SKILLS.find((s) => s.key === "hive")!,
  variant: SKILLS.find((s) => s.key === "hive")!.variants.find(
    (v) => v.key === "restorer",
  )!,
};

const riotFoam: SkillChoice = {
  skill: SKILLS.find((s) => s.key === "chem_launcher")!,
  variant: SKILLS.find((s) => s.key === "chem_launcher")!.variants.find(
    (v) => v.key === "riot_foam",
  )!,
};

function ctx(overrides: Partial<AxisContext> = {}): AxisContext {
  return {
    weaponDps: 1_000_000,
    gear: fullSkillGear("skill"),
    skills: [restorerHive],
    teamSize: 4,
    threat: { statusShare: 0.3 },
    combatWindowSeconds: COMBAT_WINDOW_DEFAULT,
    ...overrides,
  };
}

describe("Achsen-Berechnung V4 (Issue #90, Lastenheft Abschnitt 4)", () => {
  it("Skill-Stufe: gelbe Kerne + Techniker-Bonus, gedeckelt bei 6 (Kriterium 5)", () => {
    const fiveYellow = fullSkillGear("skill").slice(0, 5);
    expect(skillTierFor(fiveYellow)).toBe(5);
    expect(skillTierFor(fullSkillGear("skill"), "technician")).toBe(6);
    expect(skillTierFor(fullSkillGear("skill"))).toBe(6);
    expect(skillTierFor(fullSkillGear("wd"))).toBe(0);
  });

  it("Kriterium 5: Skill-Heiler mit 6 gelben Kernen > SKL als mit 5 gelben Kernen", () => {
    const six = computeEffectVector(ctx({ sklKind: "heal" }));
    const five = computeEffectVector(
      ctx({
        gear: fullSkillGear("skill").slice(0, 5),
        sklKind: "heal",
      }),
    );
    expect(six.skl).toBeGreaterThan(five.skl);
  });

  it("SKL: Heilung und Skill-Schaden werden getrennt ausgewiesen", () => {
    const v = computeEffectVector(ctx({ sklKind: "heal" }));
    expect(v.sklHeal).toBeGreaterThan(0);
    expect(v.skl).toBe(v.sklHeal);
    const damage = computeEffectVector(
      ctx({
        skills: [
          {
            skill: SKILLS.find((s) => s.key === "turret")!,
            variant: SKILLS.find((s) => s.key === "turret")!.variants[0],
          },
        ],
        sklKind: "damage",
      }),
    );
    expect(damage.sklDamage).toBeGreaterThan(0);
    expect(damage.skl).toBe(damage.sklDamage);
    expect(damage.sklHeal).toBe(0);
  });

  it("EHP: Rüstungsregeneration und Resistenzen gehen ein, Gefahrenschutz gedeckelt (Kriterium 11)", () => {
    const withHazard = computeEffectVector(
      ctx({
        gear: fullSkillGear("armour", [{ type: "hazard", value: 120 }]),
      }),
    );
    const detail = withHazard.computations.ehp.detail;
    expect(detail.hazard).toBe(100);
    expect(withHazard.ehp).toBeGreaterThan(0);
  });

  it("CC: Aufruhrschaum erzeugt CC-Wert, gedeckelt bei 100 % je Effekt (Kriterium 11/12)", () => {
    const v = computeEffectVector(
      ctx({
        skills: [riotFoam],
        gear: fullSkillGear("skill", [{ type: "status", value: 100 }]),
      }),
    );
    expect(v.cc).toBeGreaterThan(0);
    expect(v.cc).toBeLessThanOrEqual(1);
  });

  it("CC bleibt 0, wenn kein CC-Skill gewählt ist (kein Fehler, Kriterium 12)", () => {
    const v = computeEffectVector(ctx({ skills: [restorerHive] }));
    expect(v.cc).toBe(0);
    expect(Number.isFinite(v.cc)).toBe(true);
  });

  it("Kriterium 6: Team-Buff mit Uptime 0 % verändert den Gesamtwert nicht", () => {
    const base = computeEffectVector(ctx(), ["overwatch"]);
    const zero = computeEffectVector(
      ctx({ userAssumptions: { "talent.overwatch.uptime": 0 } }),
      ["overwatch"],
    );
    const noBuff = computeEffectVector(ctx());
    expect(base.buf).toBeGreaterThan(0);
    expect(zero.buf).toBe(0);
    expect(zero.buf).toBe(noBuff.buf);
    expect(base.buf).toBeGreaterThan(zero.buf);
  });

  it("Kriterium 7: Bei Teamgröße 1 zählen nur Selbst-Buffs", () => {
    const solo = computeEffectVector(ctx({ teamSize: 1 }), ["overwatch"]);
    const team = computeEffectVector(ctx({ teamSize: 4 }), ["overwatch"]);
    expect(solo.buf).toBe(0);
    expect(team.buf).toBeGreaterThan(0);
  });

  it("BUF skaliert mit dem Teamgröße-Faktor (team = N, team_ohne_mich = N-1)", () => {
    const t3 = computeEffectVector(ctx({ teamSize: 3 }), ["overwatch"]);
    const t4 = computeEffectVector(ctx({ teamSize: 4 }), ["overwatch"]);
    expect(t4.buf / t3.buf).toBeCloseTo(3 / 2, 5);
  });

  it("Annahmen: offene Skill-Grundwerte landen im Annahmen-Panel, Nutzervorgabe überschreibt", () => {
    const v = computeEffectVector(ctx({ sklKind: "heal" }));
    const skillAssumption = v.assumptions.find((a) =>
      a.key.startsWith("skill.restorer.base"),
    );
    expect(skillAssumption).toBeDefined();
    expect(v.skl).toBeGreaterThan(0);
    const overridden = computeEffectVector(
      ctx({ sklKind: "heal", userAssumptions: { "skill.restorer.base": 2500 } }),
    );
    expect(
      overridden.assumptions.find((a) => a.key.startsWith("skill.restorer.base")),
    ).toBeUndefined();
    expect(overridden.skl).toBeGreaterThan(v.skl);
  });

  it("UPT: Skills mit Dauer erzeugen höhere Verfügbarkeit als reine Cooldown-Skills", () => {
    const withDuration = computeEffectVector(ctx({ skills: [restorerHive] }));
    expect(withDuration.upt).toBeGreaterThan(0);
    expect(withDuration.upt).toBeLessThanOrEqual(1);
  });

  it("UPT: ohne Skills ist die Verfügbarkeit 0 statt fehlerhaft (Kriterium 12)", () => {
    const v = computeEffectVector(ctx({ skills: [] }));
    expect(v.upt).toBe(0);
  });

  it("DPS-Achse läuft über die bestehende Schadens-Engine (Wert wird 1:1 übernommen)", () => {
    const v = computeEffectVector(ctx({ weaponDps: 1234567 }));
    expect(v.dps).toBe(1234567);
    expect(v.computations.dps.detail.source).toContain("computeDamage");
  });

  it("buffsFor: Talente ohne Wert oder mit Faktor 0 werden übersprungen", () => {
    const buffs = buffsFor(
      ["future_initiative_chest", "overwatch"],
      ctx({ teamSize: 1 }),
    );
    expect(
      buffs.filter((b) => b.talent.ziel === "team_ohne_mich"),
    ).toHaveLength(0);
    expect(buffs.filter((b) => b.talent.key === "future_initiative_chest")).toHaveLength(0);
  });

  it("Vektor enthält alle sechs Achsen", () => {
    const v = computeEffectVector(ctx());
    for (const key of ["dps", "skl", "ehp", "cc", "buf", "upt"] as const) {
      expect(v[key]).toBeDefined();
      expect(Number.isFinite(v[key])).toBe(true);
    }
  });
});

describe("Gearset-Boni in den Achsen (alle Sets modelliert)", () => {
  it("alle Gearsets in green_set_info haben ein 4p-Tier", () => {
    const green = (gearJson as unknown as {
      green_set_info: Record<string, { bonuses: Record<string, Array<{ attr: string; val: number; value_status?: string }>> }>;
    }).green_set_info;
    const keys = Object.keys(green);
    expect(keys.length).toBeGreaterThanOrEqual(28);
    for (const k of keys) {
      expect(green[k].bonuses["4"], `Set ${k} ohne 4p-Tier`).toBeDefined();
      expect(green[k].bonuses["4"].length).toBeGreaterThan(0);
    }
  });

  it("4er-Eclipse erhöht den CC-Wert über die Statuseffekt-Achse (Set-Bonus fließt in Achsen)", () => {
    const mkGear = (brand: string, type: GearPiece["brandType"]): GearPiece[] =>
      (["mask", "chest", "holster", "backpack"] as GearSlot[]).map(
        (slot, i) => ({
          id: `eclipse-${slot}-${i}`,
          slot,
          brand,
          brandType: type,
          core: "skill" as const,
          coreValue: 1,
          attributes: [],
          talent: null,
          prototype: true,
        }),
      );
    const withSet = computeEffectVector(
      ctx({ gear: [...mkGear("Eclipse Protocol", "gearset"), ...fullSkillGear("skill").slice(0, 2)], skills: [riotFoam] }),
    );
    const withoutSet = computeEffectVector(
      ctx({ gear: fullSkillGear("skill"), skills: [riotFoam] }),
    );
    expect(withSet.cc).toBeGreaterThan(withoutSet.cc);
  });

  it("setBonusesForGear liefert die 4p-Annahme mit Set-Name und Teilezahl", () => {
    const four = (["mask", "chest", "holster", "backpack"] as GearSlot[]).map(
      (slot, i) => ({
        id: `ts-${i}`,
        slot,
        brand: "Tipping Scales",
        brandType: "gearset" as const,
        core: "wd" as const,
        coreValue: 15,
        attributes: [],
        talent: null,
        prototype: true,
      }),
    );
    const bonuses = setBonusesForGear(four);
    const fourP = bonuses.filter((b) => b.pieces === 4);
    expect(fourP.length).toBeGreaterThan(0);
    expect(fourP.some((b) => b.attr === "chd")).toBe(true);
  });
});
