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
  it("jede Rolle hat 2–10 Fragen (neuer Fragebogen: 4 gemeinsame + rollenspezifische)", () => {
    for (const role of ROLE_PROFILES) {
      const count = questionsForRole(role.key).length;
      expect(count, `${role.key}: ${count} Fragen`).toBeGreaterThanOrEqual(2);
      expect(count, `${role.key}: ${count} Fragen`).toBeLessThanOrEqual(10);
    }
  });

  it("Kriterium 14: gleiche Antworten ergeben immer dieselben Gewichte", () => {
    const answers = [
      { questionKey: "gameMode", optionKey: "raid" },
      { questionKey: "buildPriority", optionKey: "damage" },
      { questionKey: "distance", optionKey: "close" },
      { questionKey: "enemies", optionKey: "elite" },
      { questionKey: "hsShare", optionKey: "high" },
    ];
    const a = weightsFromAnswers("dps_krit", answers);
    const b = weightsFromAnswers("dps_krit", answers);
    expect(a).toEqual(b);
  });

  it("Gewichtsverschiebung wirkt: Build-Priorität Schaden senkt EHP, Überleben hebt es", () => {
    const base = weightsFromAnswers("dps_krit", []);
    const damage = weightsFromAnswers("dps_krit", [{ questionKey: "buildPriority", optionKey: "damage" }]);
    const survival = weightsFromAnswers("dps_krit", [{ questionKey: "buildPriority", optionKey: "survival" }]);
    expect(damage.ehp).toBeLessThan(base.ehp);
    expect(survival.ehp).toBeGreaterThan(base.ehp);
    expect(damage.dps).toBeGreaterThan(base.dps);
  });

  it("Gewichte bleiben nicht-negativ und Rollen-basiert (Expertenmodus-Basis)", () => {
    const allShifts = weightsFromAnswers("dps_krit", [
      { questionKey: "playStyle", optionKey: "aggressive" },
      { questionKey: "buildPriority", optionKey: "damage" },
      { questionKey: "gameMode", optionKey: "raid" },
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

describe("Fragebogen neu konzipiert (Issue #136)", () => {
  it("Spielmodus deckt die Content-Typen ab: Offene Welt, Missionen, Vergeltung, Raid, Incursion, Dark Zone/PvP", () => {
    const gameMode = questionsForRole("dps_krit").find((q) => q.key === "gameMode");
    expect(gameMode).toBeDefined();
    const keys = gameMode!.options.map((o) => o.key);
    expect(keys).toEqual(["openworld", "missions", "countdown", "raid", "incursion", "pvp"]);
  });

  it("redundante alte Fragen sind entfernt (Teamgröße, Distanz, Gegnermix als Fragen)", () => {
    const keys = questionsForRole("dps_krit").map((q) => q.key);
    expect(keys).not.toContain("teamSize");
    expect(keys).not.toContain("distance");
    expect(keys).not.toContain("enemies");
  });

  it("Nachlade-Verhalten nur für DPS-Rollen, mit den zwei Optionen", () => {
    const dpsKeys = questionsForRole("dps_krit").map((q) => q.key);
    expect(dpsKeys).toContain("reloadBehavior");
    const healKeys = questionsForRole("skill_heiler").map((q) => q.key);
    expect(healKeys).not.toContain("reloadBehavior");
    const reload = questionsForRole("dps_krit").find((q) => q.key === "reloadBehavior");
    expect(reload!.options.map((o) => o.key)).toEqual(["reload", "swap"]);
  });

  it("Spielmodus wirkt (noch) nicht auf die Gewichte — nur Raid/Incursion leicht EHP", () => {
    const base = weightsFromAnswers("dps_krit", []);
    const openworld = weightsFromAnswers("dps_krit", [{ questionKey: "gameMode", optionKey: "openworld" }]);
    const raid = weightsFromAnswers("dps_krit", [{ questionKey: "gameMode", optionKey: "raid" }]);
    expect(openworld.ehp).toBeCloseTo(base.ehp, 6);
    expect(raid.ehp).toBeGreaterThan(base.ehp);
  });
});
