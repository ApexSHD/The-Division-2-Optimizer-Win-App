import { describe, it, expect } from "vitest";
import { analyzeInventory, type InventoryAnalysisInput } from "../../data/inventoryAnalysis";
import { gearFromCsv } from "../../data/gearCsv";
import { weaponsFromCsv } from "../../data/weaponCsv";
import { GEAR_INVENTORY_CSV, WEAPON_INVENTORY_CSV } from "../../data/__tests__/fixtures/inventoryFixtures";
import type { ModeContext } from "../../data/operatingModes";

// Simuliert die Worker-Logik aus analysisWorker.ts (abortedIds-Set) für zwei
// aufeinanderfolgende Runs: Run 1 wird abgebrochen, Run 2 darf NICHT als aborted
// gewertet werden (Regression: abortedIds.size === 0 Check wertete Run 2 falsch).
function makeWorkerHarness() {
  const abortedIds = new Set<number>();
  const posted: unknown[] = [];
  return {
    posted,
    handle(msg: { kind: string; id: number; input?: InventoryAnalysisInput }) {
      if (msg.kind === "abort") {
        abortedIds.add(msg.id);
        return;
      }
      if (msg.kind !== "analyze" || !msg.input) return;
      const post = (m: unknown) => posted.push(m);
      const analysis = analyzeInventory({
        ...msg.input,
        onProgress: () => undefined,
        shouldAbort: () => abortedIds.has(msg.id),
      });
      const wasAborted = abortedIds.delete(msg.id);
      if (analysis && !wasAborted) {
        post({ kind: "result", id: msg.id, analysis });
      } else {
        post({ kind: "aborted", id: msg.id });
      }
    },
  };
}

function makeInput(): InventoryAnalysisInput {
  let s = 0;
  const id = () => `s${(s++).toString(36)}`;
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
  return { gear, weapons, builds: [], roleId: "weaponDps", ctx, analyzedAt: "2026-11-01T00:00:00.000Z" };
}

describe("Worker-Sequenz (Regression: zweiter Run nach Abbruch)", () => {
  it("Run 1 abgebrochen → Run 2 liefert result, nicht aborted", () => {
    const w = makeWorkerHarness();
    w.handle({ kind: "analyze", id: 1, input: makeInput() });
    w.handle({ kind: "abort", id: 1 });
    // Run 1 wurde nie zu Ende gerechnet (Effect-Cleanup) — hier simulieren wir,
    // dass der abort VOR dem analyze eintrifft (React-Cleanup-Reihenfolge):
    const w2 = makeWorkerHarness();
    w2.handle({ kind: "abort", id: 1 });
    w2.handle({ kind: "analyze", id: 1, input: makeInput() });
    w2.handle({ kind: "analyze", id: 2, input: makeInput() });
    const results = w2.posted.filter((m) => (m as { kind: string }).kind === "result") as Array<{ id: number }>;
    const aborted = w2.posted.filter((m) => (m as { kind: string }).kind === "aborted") as Array<{ id: number }>;
    expect(aborted.map((m) => m.id)).toEqual([1]);
    expect(results.map((m) => m.id)).toEqual([2]);
  }, 300000);

  it("zwei aufeinanderfolgende Runs ohne Abbruch → beide result", () => {
    const w = makeWorkerHarness();
    w.handle({ kind: "analyze", id: 1, input: makeInput() });
    w.handle({ kind: "analyze", id: 2, input: makeInput() });
    const results = w.posted.filter((m) => (m as { kind: string }).kind === "result") as Array<{ id: number }>;
    expect(results.map((m) => m.id).sort()).toEqual([1, 2]);
  }, 300000);
});
