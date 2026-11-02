import { describe, it, expect } from "vitest";
import { PLAY_STYLE_QUESTIONS, weightsWithPlayStyle, metricHintFromAnswers } from "../playStyle";
import { roleProfile } from "../roleProfiles";
import { optimizeV4, type ModeContext } from "../operatingModes";
import { DEFAULT_OPTIMIZATION } from "../../store";
import { sampleWeapons, type GearPiece, type GearSlot } from "../sampleData";

function gear(slot: GearSlot, chd: number): GearPiece {
  return { id: slot, slot, brand: "Test", brandType: "brand", core: "wd", coreValue: 15, attributes: [{ type: "chd" as never, value: chd }], talent: null, prototype: true };
}
const inv: GearPiece[] = (["mask", "chest", "holster", "backpack", "gloves", "kneepads"] as GearSlot[]).map((s) => gear(s, 12));

function ctx(playStyle: Record<string, string>): ModeContext {
  return {
    mode: "inventar", roleKey: "dps_krit", skills: [], teamSize: 4, shdLevel: 1000,
    settings: { ...DEFAULT_OPTIMIZATION },
    threatStatusShare: 0.3, spec: "",
    userAssumptions: { playStyle: playStyle as never },
  };
}

describe("CR-02 OP-2.10: 3 Spielstil-Fragen mit Gewichte-Vorschau", () => {
  it("3 Fragen, jede mit Optionen und weightShift", () => {
    expect(PLAY_STYLE_QUESTIONS).toHaveLength(3);
    for (const q of PLAY_STYLE_QUESTIONS) expect(q.options.length).toBeGreaterThanOrEqual(2);
  });

  it("weightsWithPlayStyle: 'survival' hebt ehp, 'damage' hebt dps und senkt ehp", () => {
    const base = roleProfile("dps_krit").weights;
    const survival = weightsWithPlayStyle("dps_krit", { buildPriority: "survival" });
    expect(survival.ehp).toBeCloseTo(base.ehp + 0.15, 2);
    expect(survival.dps).toBeCloseTo(base.dps - 0.05, 2);
    const damage = weightsWithPlayStyle("dps_krit", { buildPriority: "damage" });
    expect(damage.dps).toBeCloseTo(base.dps + 0.1, 2);
    expect(damage.ehp).toBeCloseTo(base.ehp - 0.1, 2);
  });

  it("keine Antwort = Basisgewichte", () => {
    expect(weightsWithPlayStyle("dps_krit", {})).toEqual(roleProfile("dps_krit").weights);
  });

  it("metricHint: reloadBehavior=swap -> rotation", () => {
    expect(metricHintFromAnswers({ reloadBehavior: "swap" })).toBe("rotation");
    expect(metricHintFromAnswers({ reloadBehavior: "reload" })).toBe("sustained");
    expect(metricHintFromAnswers({})).toBeNull();
  });

  it("optimizeV4 wendet playStyle-Gewichte im Ranking an (survival vs damage unterscheiden sich)", () => {
    const a = optimizeV4([sampleWeapons[0]], inv, ctx({ buildPriority: "damage" }), { maxResults: 5 });
    const b = optimizeV4([sampleWeapons[0]], inv, ctx({ buildPriority: "survival" }), { maxResults: 5 });
    expect(a.ranked.length).toBeGreaterThan(0);
    expect(b.ranked.length).toBeGreaterThan(0);
    // beide laufen durch; Scores unterscheiden sich über die Gewichte
    expect(a.ranked[0].score).not.toBe(b.ranked[0].score);
  }, 60000);
});
