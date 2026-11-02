import { describe, it, expect } from "vitest";
import { evaluateBuild, enemyProfileFromSettings } from "../damage";
import { defaultSetBonusCatalog } from "../operatingModes";
import { DEFAULT_OPTIMIZATION } from "../../store";
import { sampleWeapons, type GearPiece, type GearSlot } from "../sampleData";

function g(slot: GearSlot, brand: string, brandType: GearPiece["brandType"] = "brand"): GearPiece {
  return { id: `${slot}-${brand}-${Math.random().toString(36).slice(2, 6)}`, slot, brand, brandType, core: "wd", coreValue: 15, attributes: [], talent: null, prototype: true };
}

const ar = sampleWeapons.find((w) => w.type === "ar")!;
const shotgun = sampleWeapons.find((w) => w.type === "shotgun")!;
const profile = enemyProfileFromSettings(DEFAULT_OPTIMIZATION);
const cat = defaultSetBonusCatalog();

function evalGear(weapon: typeof ar, gear: GearPiece[]) {
  return evaluateBuild(weapon, gear, { shdLevel: 1000, profile, setBonusCatalog: cat });
}

describe("CR-02 P4: Brandset-Stufen kumulativ (2./3. Bonus greift)", () => {
  it("Česká 1pc = +8 CHC; 2pc (Shotgun) = zusätzlich +24 WD; 3pc = zusätzlich +30 hazard→dta", () => {
    const one = evalGear(ar, [g("mask", "Česká Výroba S.R.O.")]);
    const twoAr = evalGear(ar, [g("mask", "Česká Výroba S.R.O."), g("chest", "Česká Výroba S.R.O.")]);
    const twoSg = evalGear(shotgun, [g("mask", "Česká Výroba S.R.O."), g("chest", "Česká Výroba S.R.O.")]);
    const threeSg = evalGear(shotgun, [g("mask", "Česká Výroba S.R.O."), g("chest", "Česká Výroba S.R.O."), g("holster", "Česká Výroba S.R.O.")]);
    // 1pc CHC-Bonus greift immer
    expect(one.stats.chc).toBeGreaterThan(10); // 10 = SHD-Uhr
    // 2pc bei AR: wd_by_weapon nur für Shotgun -> kein zusätzlicher WD (nur 2 Kerne statt 1)
    expect(twoAr.stats.wd).toBe(one.stats.wd + 15); // zweiter Kern
    // 2pc bei Shotgun: +24 WD (wd_by_weapon Shotgun) — ABER Waffe ist andere: vergleiche gleiche Waffe
    const oneSg = evalGear(shotgun, [g("mask", "Česká Výroba S.R.O.")]);
    expect(twoSg.stats.wd).toBe(oneSg.stats.wd + 15 + 24);
    // 3pc: zusätzlich hazard 30 -> dta
    expect(threeSg.stats.dta).toBe(twoSg.stats.dta + 30);
    // CHC bleibt über alle Stufen kumulativ (1pc)
    expect(threeSg.stats.chc).toBe(one.stats.chc);
  });

  it("Walker 1pc +6 WD, 2pc zusätzlich +5 DTA, 3pc zusätzlich +10 DTH — alle kumulativ", () => {
    const one = evalGear(ar, [g("mask", "Walker, Harris & Co.")]);
    const two = evalGear(ar, [g("mask", "Walker, Harris & Co."), g("chest", "Walker, Harris & Co.")]);
    const three = evalGear(ar, [g("mask", "Walker, Harris & Co."), g("chest", "Walker, Harris & Co."), g("holster", "Walker, Harris & Co.")]);
    expect(one.stats.wd).toBe(15 + 6 + 10); // Kern 15 + 1pc WD 6 + SHD 10
    expect(two.stats.wd).toBe(one.stats.wd + 15); // zweiter Kern
    expect(two.stats.dta).toBe(one.stats.dta + 5);
    expect(three.stats.dth).toBe(two.stats.dth + 10);
    expect(three.stats.dta).toBe(two.stats.dta); // 3pc ändert DTA nicht
  });
});
