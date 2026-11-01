import { it, expect } from "vitest";
import { gearFromCsv } from "../../data/gearCsv";
import { weaponsFromCsv } from "../../data/weaponCsv";
import { analyzeInventory, type InventoryAnalysisInput } from "../../data/inventoryAnalysis";
import { GEAR_INVENTORY_CSV, WEAPON_INVENTORY_CSV } from "../../data/__tests__/fixtures/inventoryFixtures";
import type { ModeContext } from "../../data/operatingModes";

function makeInput(): InventoryAnalysisInput {
  let s = 0;
  const id = () => `r${(s++).toString(36)}`;
  const { gear } = gearFromCsv(GEAR_INVENTORY_CSV, id);
  const { weapons } = weaponsFromCsv(WEAPON_INVENTORY_CSV, id);
  const ctx: ModeContext = {
    mode: "inventar", roleKey: "dps_krit", skills: [], teamSize: 4, shdLevel: 1000,
    settings: {
      targetMetric: "sustained", targetHsd: 100, difficultyKey: "heroic", enemyTeamSize: 4,
      role: "weaponDps", targetChc: 50, lockedGearIds: [], anchorWeaponId: "", weaponTypeFilter: "",
      qualityFilter: "all", preferredBrand: "", considerWeaponTalents: true, considerGearTalents: true,
      considerExoticPerks: true, enemyArmorShare: 80, enemyHealthShare: 20, enemyOocShare: 70,
      enemyHeadshotShare: 0, requiredChest: false, requiredBackpack: false, targetGearSet: "",
    },
    threatStatusShare: 0.3, spec: "sharpshooter",
  };
  return { gear, weapons, builds: [], roleId: "weaponDps", ctx, keepMarkedIds: [] };
}

it("Worker-Payload ist structured-clone-fähig (JSON-Roundtrip) und liefert identisches Ergebnis", () => {
  const input = makeInput();
  const cloned = structuredClone(JSON.parse(JSON.stringify({ ...input, onProgress: undefined, shouldAbort: undefined })));
  const a1 = analyzeInventory({ ...input, analyzedAt: "2026-11-01T00:00:00.000Z" });
  const a2 = analyzeInventory({ ...cloned, analyzedAt: "2026-11-01T00:00:00.000Z" });
  const strip = (x: unknown): unknown => JSON.parse(JSON.stringify(x));
  expect(strip(a2)).toEqual(strip(a1));
  expect(a2.gapRecommendations.length).toBeGreaterThan(0);
}, 180000);
