import { describe, it, expect } from "vitest";
import talentsDisplay from "../../db/talents-display.json";
import talentDb from "../../db/talent.json";

const TYPE_TO_CAT: Record<string, string> = {
  Rifle: "Gewehre",
  AR: "Sturmgewehre",
  MMR: "Pr\u00e4zisionsgewehre",
  MP: "Maschinenpistolen",
  LMG: "Leichte Maschinengewehre",
  Shotgun: "Schrotflinten",
  Pistol: "Pistolen",
};

describe("Talent-Vollst\u00e4ndigkeit je Waffengattung (Nutzer-Fund: Raserei nicht erfassbar)", () => {
  it("jedes Grundtalent aus talent.json ist in der passenden talents-display-Kategorie erfassbar", () => {
    const display = talentsDisplay as unknown as Record<string, Array<{ name: string }>>;
    const allDisplay = new Set(
      Object.values(display).flatMap((cat) => cat.map((t) => t.name)),
    );
    const talents = (talentDb as unknown as { talents: Array<{ label: string }> }).talents;
    for (const t of talents) {
      expect(
        allDisplay.has(t.label),
        `Grundtalent "${t.label}" fehlt in der Talent-Auswahl`,
      ).toBe(true);
    }
  });

  it("Raserei ist unter LMG ausw\u00e4hlbar", () => {
    const display = talentsDisplay as unknown as Record<string, Array<{ name: string }>>;
    expect(
      display["Leichte Maschinengewehre"].some((t) => t.name === "Raserei"),
    ).toBe(true);
  });

  it("je Gattung sind mindestens 3 Grundtalente vorhanden (ohne Perfekt-Varianten)", () => {
    const display = talentsDisplay as unknown as Record<string, Array<{ name: string }>>;
    for (const cat of Object.values(TYPE_TO_CAT)) {
      const base = display[cat].filter((t) => !t.name.startsWith("Perfekt"));
      expect(base.length, cat).toBeGreaterThanOrEqual(3);
    }
  });
});
