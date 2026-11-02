import { describe, it, expect } from "vitest";
import { computeGapRecommendations } from "../gapRecommendations";
import { analyzeInventory, dbGearPool } from "../inventoryAnalysis";
import { gearFromCsv } from "../gearCsv";
import { weaponsFromCsv } from "../weaponCsv";
import { GEAR_INVENTORY_CSV_1, WEAPON_INVENTORY_CSV_1 } from "./fixtures/cr02Fixtures";
import type { ModeContext } from "../operatingModes";
import { DEFAULT_OPTIMIZATION } from "../../store";

function load() {
  let s = 0;
  const id = () => `g${(s++).toString(36)}`;
  const g = gearFromCsv(GEAR_INVENTORY_CSV_1, id);
  const w = weaponsFromCsv(WEAPON_INVENTORY_CSV_1, id);
  return { gear: g.gear, weapons: w.weapons };
}

function ctx(): ModeContext {
  return {
    mode: "inventar",
    roleKey: "dps_krit",
    skills: [],
    teamSize: 4,
    shdLevel: 1000,
    settings: { ...DEFAULT_OPTIMIZATION, considerWeaponTalents: false, considerGearTalents: false, considerExoticPerks: false },
    threatStatusShare: 0.3,
    spec: "sharpshooter",
  };
}

describe("CR-02 P3: gemeinsame Lücken-Logik (OP-4.7/OP-6.1, AK-11)", () => {
  it("AK-11: computeGapRecommendations liefert Gewinn > 0, sortiert, mit Quelle", () => {
    const { gear, weapons } = load();
    const recs = computeGapRecommendations({
      weapons,
      inventarGear: gear,
      fullGear: dbGearPool(gear),
      ctx: ctx(),
      roleKey: "dps_krit",
    });
    expect(recs.length).toBeGreaterThan(0);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].gainPercent ?? -1).toBeGreaterThanOrEqual(recs[i].gainPercent ?? -1);
    }
    for (const r of recs) {
      expect(r.gainPercent).not.toBeNull();
      expect(r.gainPercent).toBeGreaterThan(0);
      expect(r.source.item.length).toBeGreaterThan(0);
      expect(["A", "B"]).toContain(r.stage);
    }
  }, 180000);

  it("Inventaranalyse nutzt dasselbe Modul — identische Empfehlungen", () => {
    const { gear, weapons } = load();
    const c = ctx();
    const analysis = analyzeInventory({ gear, weapons, builds: [], roleId: "dps_krit", ctx: c });
    const direct = computeGapRecommendations({
      weapons,
      inventarGear: gear,
      fullGear: dbGearPool(gear),
      ctx: c,
      roleKey: "dps_krit",
    });
    const strip = (list: typeof direct) => list.map((r) => ({ slot: r.slot, target: r.targetName, gain: r.gainPercent }));
    expect(strip(analysis.gapRecommendations)).toEqual(strip(direct));
  }, 300000);
});
