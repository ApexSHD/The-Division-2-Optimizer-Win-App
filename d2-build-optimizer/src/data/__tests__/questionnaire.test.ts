import { describe, it, expect } from "vitest";
import {
  questionsForRole,
  weightsFromAnswers,
  suggestSpecialization,
  GOALS,
  ROLE_PROFILES,
} from "../questionnaire";
import { SKILLS } from "../v4Data";
import type { SkillChoice } from "../axes";

const hive: SkillChoice = {
  skill: SKILLS.find((s) => s.key === "hive")!,
  variant: SKILLS.find((s) => s.key === "hive")!.variants.find((v) => v.key === "restorer")!,
};

describe("Fragebogen V4 (Issue #95, Lastenheft 3.3)", () => {
  it("jede Rolle hat 5–10 Fragen (Kriterium 15)", () => {
    for (const role of ROLE_PROFILES) {
      const count = questionsForRole(role.key).length;
      expect(count, `${role.key}: ${count} Fragen`).toBeGreaterThanOrEqual(5);
      expect(count, `${role.key}: ${count} Fragen`).toBeLessThanOrEqual(10);
    }
  });

  it("Kriterium 14: gleiche Antworten ergeben immer dieselben Gewichte", () => {
    const answers = [
      { questionKey: "teamSize", optionKey: "full" },
      { questionKey: "distance", optionKey: "close" },
      { questionKey: "enemies", optionKey: "elite" },
      { questionKey: "hsShare", optionKey: "high" },
    ];
    const a = weightsFromAnswers("dps_krit", answers);
    const b = weightsFromAnswers("dps_krit", answers);
    expect(a).toEqual(b);
  });

  it("Gewichtsverschiebung wirkt: Solo senkt BUF, volles Team erhöht BUF", () => {
    const base = weightsFromAnswers("buffer", []);
    const solo = weightsFromAnswers("buffer", [{ questionKey: "teamSize", optionKey: "solo" }]);
    const full = weightsFromAnswers("buffer", [{ questionKey: "teamSize", optionKey: "full" }]);
    expect(solo.buf).toBeLessThan(base.buf);
    expect(full.buf).toBeGreaterThan(base.buf);
  });

  it("Gewichte bleiben nicht-negativ und Rollen-basiert (Expertenmodus-Basis)", () => {
    const allShifts = weightsFromAnswers("dps_krit", [
      { questionKey: "teamSize", optionKey: "solo" },
      { questionKey: "distance", optionKey: "far" },
      { questionKey: "enemies", optionKey: "trash" },
    ]);
    for (const value of Object.values(allShifts)) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it("Hybrid-Fragebogen enthält Hybrid-Typ und 3/3-vs-4/2", () => {
    const questions = questionsForRole("hybrid_schaden_skill");
    const keys = questions.map((q) => q.key);
    expect(keys).toContain("hybridType");
    expect(keys).toContain("hybridDist");
  });
});

describe("Spezialisierungs-Vorschlag V4 (Issue #95, Lastenheft 3.4)", () => {
  it("Kriterium 16: Vorschlag ist reproduzierbar", () => {
    const w = weightsFromAnswers("skill_heiler", [
      { questionKey: "teamSize", optionKey: "full" },
      { questionKey: "healWindow", optionKey: "sustain" },
      { questionKey: "reviver", optionKey: "yes" },
    ]);
    const a = suggestSpecialization("skill_heiler", w, 4, [hive]);
    const b = suggestSpecialization("skill_heiler", w, 4, [hive]);
    expect(a.best.key).toBe(b.best.key);
    expect(a.best.score).toBe(b.best.score);
  });

  it("Skill-lastige Rollen bekommen den Techniker vorgeschlagen (+1 Fertigkeitenrang)", () => {
    const w = weightsFromAnswers("skill_heiler", [{ questionKey: "teamSize", optionKey: "full" }]);
    const result = suggestSpecialization("skill_heiler", w, 4, [hive]);
    expect(result.best.key).toBe("technician");
    expect(result.best.reason).toContain("Fertigkeitenrang");
  });

  it("Vorschlag nennt Begründung und Zweitplatzierte mit Abstand", () => {
    const w = weightsFromAnswers("dps_krit", []);
    const result = suggestSpecialization("dps_krit", w, 4, []);
    expect(result.best.reason).toBeTruthy();
    expect(result.second).toBeDefined();
    expect(result.all).toHaveLength(6);
  });

  it("Bei Solo (Teamgröße 1) verlieren Team-Buffs an Gewicht", () => {
    const w = weightsFromAnswers("buffer", [{ questionKey: "teamSize", optionKey: "solo" }]);
    const solo = suggestSpecialization("buffer", w, 1, []);
    const team = suggestSpecialization("buffer", w, 4, []);
    expect(team.best.score).toBeGreaterThan(solo.best.score);
  });
});

describe("Ziele-Struktur (Lastenheft 3)", () => {
  it("vier Ziele, elf Rollen, jede Rolle eindeutig zugeordnet", () => {
    expect(GOALS).toHaveLength(4);
    expect(ROLE_PROFILES).toHaveLength(11);
    const allRoleKeys = GOALS.flatMap((g) => g.roles);
    expect(new Set(allRoleKeys).size).toBe(allRoleKeys.length);
  });
});
