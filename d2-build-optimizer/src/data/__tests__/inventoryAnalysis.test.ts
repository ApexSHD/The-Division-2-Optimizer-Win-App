import { describe, expect, it } from "vitest";
import { gearFromCsv } from "../gearCsv";
import { weaponsFromCsv } from "../weaponCsv";
import { analyzeInventory, gearRollRatio, weaponRollRatio, WEAPON_TYPE_LABELS } from "../inventoryAnalysis";
import type { InventoryAnalysis } from "../inventoryAnalysis";
import { GEAR_INVENTORY_CSV, WEAPON_INVENTORY_CSV } from "./fixtures/inventoryFixtures";
import type { ModeContext } from "../operatingModes";

const gearCsv = GEAR_INVENTORY_CSV;
const weaponCsv = WEAPON_INVENTORY_CSV;

let seq = 0;
const nextId = () => `fx${(seq++).toString(36)}`;

function fixtureAnalysis(): InventoryAnalysis {
  const { gear } = gearFromCsv(gearCsv, nextId);
  const { weapons } = weaponsFromCsv(weaponCsv, nextId);
  return analyzeInventory({ gear, weapons, builds: [], analyzedAt: "2026-11-01T14:05:00.000Z" });
}

describe("Inventaranalyse gegen Beispieldaten (Lastenheft Abschnitt 10)", () => {
  it("AK-1: Slot-Verteilung Maske 4, Rucksack 3, Holster 3, Knieschoner 3, Weste 3, Handschuhe 2 (18)", () => {
    const a = fixtureAnalysis();
    expect(a.gearTotal).toBe(18);
    const bySlot = Object.fromEntries(a.slotCoreMatrix.map((c) => [c.slot, c.rot + c.blau + c.gelb]));
    expect(bySlot).toEqual({ mask: 4, backpack: 3, holster: 3, kneepads: 3, chest: 3, gloves: 2 });
  });

  it("AK-2: Kernfarben Rot 18, Blau 0, Gelb 0 + Erkenntnis", () => {
    const a = fixtureAnalysis();
    expect(a.coreTotals).toEqual({ rot: 18, blau: 0, gelb: 0 });
    expect(a.insights.some((i) => i.id === "no-blue-yellow-core" && i.severity === "warning")).toBe(true);
  });

  it("AK-3: Seltenheit Gear: Gear-Set 8, High-End 6, Named 2, Exotic 2", () => {
    const a = fixtureAnalysis();
    expect(a.gearRarity).toEqual({ highend: 6, gearset: 8, named: 2, exotic: 2 });
  });

  it("AK-4: Set-Fortschritt Striker's 4 Teile und Tipping Scales 4 Teile", () => {
    const a = fixtureAnalysis();
    const striker = a.setProgress.find((s) => s.name.includes("Striker"));
    const tipping = a.setProgress.find((s) => s.name.includes("Tipping"));
    expect(striker?.pieces).toBe(4);
    expect(tipping?.pieces).toBe(4);
    expect(striker?.reachedBonuses.some((b) => b.pieces === 4)).toBe(true);
  });

  it("AK-5: Konflikt Striker's vs. Tipping Scales (gleiche 4 Slots)", () => {
    const a = fixtureAnalysis();
    const conflict = a.setConflicts.find(
      (c) =>
        (c.a.includes("Striker") && c.b.includes("Tipping")) ||
        (c.a.includes("Tipping") && c.b.includes("Striker")),
    );
    expect(conflict).toBeDefined();
    expect(conflict!.sharedSlots.length).toBe(4);
  });

  it("AK-6: Exotic-Limit-Hinweis (Catalyst + Memento)", () => {
    const a = fixtureAnalysis();
    expect(a.exoticGearCount).toBe(2);
    expect(a.exoticLimitViolation).toBe(true);
    expect(a.insights.some((i) => i.id === "exotic-limit")).toBe(true);
  });

  it("AK-7: Waffen nach Typ LMG 8, AR 7, Gewehr 2, Schrotflinte 1, MP 1; MMR+Pistole fehlen", () => {
    const a = fixtureAnalysis();
    const byType = Object.fromEntries(a.weaponTypeCoverage.map((c) => [c.type, c.count]));
    expect(byType).toEqual({ ar: 7, smg: 1, lmg: 8, rifle: 2, mmr: 0, shotgun: 1, pistol: 0 });
    const missing = a.weaponTypeCoverage.filter((c) => c.count === 0).map((c) => c.type);
    expect(missing).toEqual(["mmr", "pistol"]);
  });

  it("AK-8: Varianten HK GR9 x3, SOCOM Mk16 x2 als Familie", () => {
    const a = fixtureAnalysis();
    const gr9 = a.weaponFamilies.find((f) => f.name === "HK GR9");
    const socom = a.weaponFamilies.find((f) => f.name === "SOCOM Mk16");
    expect(gr9?.count).toBe(3);
    expect(socom?.count).toBe(2);
  });

  it("AK-9: Seltenheit Waffen High-End 12, Named 4, Exotic 3", () => {
    const a = fixtureAnalysis();
    expect(a.weaponRarity.highend).toBe(12);
    expect(a.weaponRarity.named).toBe(4);
    expect(a.weaponRarity.exotic).toBe(3);
  });

  it("AK-11: Leerer Zustand ohne Fehler", () => {
    const a = analyzeInventory({ gear: [], weapons: [], builds: [], analyzedAt: "2026-11-01T00:00:00.000Z" });
    expect(a.gearTotal).toBe(0);
    expect(a.weaponTotal).toBe(0);
    expect(a.health.total).toBe(0);
    expect(a.insights).toHaveLength(0);
    expect(a.cleanupCandidates).toHaveLength(0);
  });

  it("AK-13: Analyse ist read-only – Eingaben bleiben unverändert", () => {
    const { gear } = gearFromCsv(gearCsv, nextId);
    const { weapons } = weaponsFromCsv(weaponCsv, nextId);
    const snapshot = JSON.stringify({ gear, weapons });
    analyzeInventory({ gear, weapons, builds: [] });
    expect(JSON.stringify({ gear, weapons })).toBe(snapshot);
  });

  it("Roll-Qualität: Prototyp-Max (x1,5) wird berücksichtigt", () => {
    const { gear } = gearFromCsv(gearCsv, nextId);
    for (const g of gear) {
      const ratio = gearRollRatio(g);
      expect(ratio).toBeLessThanOrEqual(1.0001);
    }
  });

  it("Waffen-Roll-Qualität liegt in [0,1]", () => {
    const { weapons } = weaponsFromCsv(weaponCsv, nextId);
    for (const w of weapons) {
      const ratio = weaponRollRatio(w);
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThanOrEqual(1.0001);
    }
  });

  it("Determinismus: gleiche Eingabe, gleiches Ergebnis (abgesehen von IDs)", () => {
    const a = fixtureAnalysis();
    const b = fixtureAnalysis();
    const strip = (x: unknown) =>
      JSON.stringify(x, (k, v) =>
        k === "pieceId" || k === "weaponId" || k === "bestWeaponId" || k === "bestId" || k === "worstId" || k.endsWith("Ids") || k === "dominatesPieceId"
          ? undefined
          : v,
      );
    expect(strip(a)).toBe(strip(b));
  });

  it("Waffentyp-Labels vorhanden für alle 7 Typen", () => {
    expect(Object.keys(WEAPON_TYPE_LABELS)).toHaveLength(7);
  });

  it("AK-10: Empfehlungen nach echtem Gewinn sortiert, mit Gewinn % und Bezugsquelle", () => {
    let s = 0;
    const id = () => `g${(s++).toString(36)}`;
    const { gear } = gearFromCsv(GEAR_INVENTORY_CSV, id);
    const { weapons } = weaponsFromCsv(WEAPON_INVENTORY_CSV, id);
    const ctx: ModeContext = {
      mode: "inventar",
      roleKey: "dps_krit",
      skills: [],
      teamSize: 4,
      shdLevel: 1000,
      settings: {
        targetMetric: "sustained", targetHsd: 100, difficultyKey: "heroic", enemyTeamSize: 4,
        role: "weaponDps", targetChc: 50, lockedGearIds: [], anchorWeaponId: "", weaponTypeFilter: "",
        qualityFilter: "all", preferredBrand: "", considerWeaponTalents: true, considerGearTalents: true,
        considerExoticPerks: true, enemyArmorShare: 80, enemyHealthShare: 20, enemyOocShare: 70,
        enemyHeadshotShare: 0, requiredChest: false, requiredBackpack: false, targetGearSet: "",
      },
      threatStatusShare: 0.3,
      spec: "sharpshooter",
    };
    const a = analyzeInventory({ gear, weapons, builds: [], roleId: "weaponDps", ctx });
    expect(a.gapRecommendations.length).toBeGreaterThan(0);
    for (let i = 1; i < a.gapRecommendations.length; i++) {
      const prev = a.gapRecommendations[i - 1].gainPercent ?? -1;
      const cur = a.gapRecommendations[i].gainPercent ?? -1;
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
    for (const r of a.gapRecommendations) {
      expect(r.gainPercent).not.toBeNull();
      expect(r.gainPercent).toBeGreaterThan(0);
      expect(r.source.item.length).toBeGreaterThan(0);
      expect(["A", "B"]).toContain(r.stage);
    }
    expect(a.reachabilityByRole.length).toBeGreaterThan(0);
    expect(a.reachabilityByRole[0].reachabilityPercent).not.toBeNull();
  }, 120000);
});
