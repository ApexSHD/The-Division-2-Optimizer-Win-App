import { describe, it, expect } from "vitest";
import { gearFromCsv } from "../gearCsv";
import { weaponsFromCsv } from "../weaponCsv";
import { optimizeV4, type ModeContext } from "../operatingModes";
import { DEFAULT_OPTIMIZATION } from "../../store";
import { GEAR_INVENTORY_CSV_2, WEAPON_INVENTORY_CSV_2 } from "./fixtures/cr02Fixtures2";

function load() {
  let s = 0;
  const id = () => `e${(s++).toString(36)}`;
  const g = gearFromCsv(GEAR_INVENTORY_CSV_2, id);
  const w = weaponsFromCsv(WEAPON_INVENTORY_CSV_2, id);
  return { gear: g.gear, weapons: w.weapons };
}

function ctx(overrides: Partial<ModeContext["settings"]> = {}): ModeContext {
  return {
    mode: "inventar",
    roleKey: "dps_krit",
    skills: [],
    teamSize: 4,
    shdLevel: 1000,
    settings: { ...DEFAULT_OPTIMIZATION, ...overrides },
    threatStatusShare: 0.3,
    spec: "sharpshooter",
  };
}

describe("CR-02 E2E: Tipping Scales als Ziel-Set (User-Fixtures 2026-11-02)", () => {
  it("targetGearSet=Tipping Scales: alle Kandidaten mit 4 Tipping-Teilen", () => {
    const { gear, weapons } = load();
    const tipping = gear.filter((g) => g.brandType === "gearset" && g.brand.toLowerCase().includes("tipping"));
    expect(tipping).toHaveLength(4);
    const r = optimizeV4(weapons, gear, ctx({ targetGearSet: "Tipping Scales" }), { maxResults: 10 });
    expect(r.candidates.length).toBeGreaterThan(0);
    for (const c of r.candidates) {
      const n = c.gear.filter((g) => g.brandType === "gearset" && g.brand.toLowerCase().includes("tipping")).length;
      expect(n).toBe(4);
    }
    expect(r.warnings.some((w) => w.includes("Gearset-Ziel"))).toBe(true);
  }, 180000);

  it("ohne Ziel-Set: Tipping 4pc ist eine Option unter mehreren (kein Zwang)", () => {
    const { gear, weapons } = load();
    const r = optimizeV4(weapons, gear, ctx(), { maxResults: 10 });
    expect(r.candidates.length).toBeGreaterThan(0);
  }, 180000);
});
