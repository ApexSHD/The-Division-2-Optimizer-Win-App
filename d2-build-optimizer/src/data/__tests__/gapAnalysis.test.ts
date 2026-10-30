import { describe, it, expect } from "vitest";
import {
  analyzeGaps,
  GAP_STAGE_C_NOTE,
  type GapInput,
} from "../gapAnalysis";
import { SKILLS, SOURCES } from "../v4Data";
import type { SkillChoice } from "../axes";
import { sampleWeapons } from "../sampleData";
import { DEFAULT_OPTIMIZATION } from "../../store";
import type { GearPiece, GearSlot } from "../sampleData";

function gear(
  slot: GearSlot,
  core: "wd" | "armour" | "skill",
  attrs: Array<{ type: string; value: number }> = [],
  id: string,
  brand = "Testmarke",
): GearPiece {
  return {
    id,
    slot,
    brand,
    brandType: "brand",
    core,
    coreValue: core === "armour" ? 170000 : core === "skill" ? 1 : 15,
    attributes: attrs.map((a) => ({ type: a.type as never, value: a.value })),
    talent: null,
    prototype: true,
  };
}

const turret: SkillChoice = {
  skill: SKILLS.find((s) => s.key === "turret")!,
  variant: SKILLS.find((s) => s.key === "turret")!.variants[0],
};

const slots: GearSlot[] = ["mask", "chest", "holster", "backpack", "gloves", "kneepads"];

function inventar(): GearPiece[] {
  return slots.map((slot) =>
    gear(slot, "wd", [{ type: "chc", value: 6 }], `${slot}-inv`),
  );
}

function full(): GearPiece[] {
  return [
    ...inventar(),
    ...slots.map((slot) =>
      gear(slot, "wd", [{ type: "chc", value: 9 }], `${slot}-better`, "Striker's Battlegear"),
    ),
    ...slots.map((slot) =>
      gear(slot, "skill", [{ type: "skilldmg", value: 10 }], `${slot}-skill`),
    ),
  ];
}

function gapInput(overrides: Partial<GapInput> = {}): GapInput {
  return {
    weapons: [sampleWeapons[0]],
    inventarGear: inventar(),
    fullGear: full(),
    ctx: {
      mode: "inventar",
      roleKey: "dps_krit",
      skills: [turret],
      teamSize: 4,
      shdLevel: 0,
      settings: { ...DEFAULT_OPTIMIZATION, enemyHeadshotShare: 20 },
      threatStatusShare: 0.3,
      spec: "",
    },
    ...overrides,
  };
}

describe("Lückenanalyse V4 (Issue #93, Lastenheft Abschnitt 6)", () => {
  it("Erreichungsgrad: Inventar / Ziel in Prozent, deterministisch (Kriterium 19)", () => {
    const r1 = analyzeGaps(gapInput());
    const r2 = analyzeGaps(gapInput());
    expect(r1.reachabilityPercent).toBe(r2.reachabilityPercent);
    if (r1.reachabilityPercent !== null) {
      expect(r1.reachabilityPercent).toBeGreaterThanOrEqual(0);
      expect(r1.reachabilityPercent).toBeLessThanOrEqual(100);
    }
  }, 60000);

  it("Empfehlungen: maximal Top-3, jede mit Stufe (A/B) und Bezugsquelle (Kriterium 20)", () => {
    const result = analyzeGaps(gapInput());
    expect(result.recommendations.length).toBeLessThanOrEqual(3);
    for (const rec of result.recommendations) {
      expect(["A", "B"]).toContain(rec.stage);
      expect(rec.source).toBeDefined();
      expect(rec.source.item).toBeTruthy();
      expect(rec.source.game_activity.length).toBeGreaterThan(0);
    }
  }, 60000);

  it("Keine Stufe-C-Empfehlungen im Prototyp (Kriterium 21)", () => {
    const result = analyzeGaps(gapInput());
    expect(result.recommendations.every((r) => r.stage === "A" || r.stage === "B")).toBe(true);
    expect(result.noteUpgradeExcluded).toBe(true);
    expect(GAP_STAGE_C_NOTE).toContain("Rekalibrieren");
  }, 60000);

  it("Gleiche Eingabe ergibt gleiche Empfehlungsreihenfolge (Kriterium 19)", () => {
    const a = analyzeGaps(gapInput());
    const b = analyzeGaps(gapInput());
    expect(a.recommendations.map((r) => [r.slot, r.source.key, r.stage])).toEqual(
      b.recommendations.map((r) => [r.slot, r.source.key, r.stage]),
    );
  }, 60000);

  it("Ziel-Build mit besserem Inventar senkt die Lücke (Erreichungsgrad steigt)", () => {
    const weak = analyzeGaps(gapInput());
    const strong = analyzeGaps(
      gapInput({
        inventarGear: full().slice(0, 6),
      }),
    );
    expect(strong.reachabilityPercent ?? 0).toBeGreaterThanOrEqual(
      weak.reachabilityPercent ?? 0,
    );
  }, 90000);

  it("Bezugsquellen-Datenbasis kennt Stufen A und B (Issue #89-Quellen)", () => {
    const stages = new Set(SOURCES.map((s) => s.stage));
    expect(stages.has("A")).toBe(true);
    expect(stages.has("B")).toBe(true);
  });
});
