import { describe, it, expect, vi } from "vitest";
import { analyzeInventory, type InventoryAnalysis, type InventoryAnalysisInput } from "../../data/inventoryAnalysis";
import { gearFromCsv } from "../../data/gearCsv";
import { weaponsFromCsv } from "../../data/weaponCsv";
import { GEAR_INVENTORY_CSV, WEAPON_INVENTORY_CSV } from "../../data/__tests__/fixtures/inventoryFixtures";
import type { ModeContext } from "../../data/operatingModes";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  private queue: unknown[] = [];
  constructor(_url: URL, _opts: unknown) {
    FakeWorker.instances.push(this);
  }
  postMessage(msg: unknown) {
    this.queue.push(msg);
    // synchron "ausführen": Worker-Logik aus analysisWorker.ts nachbilden
    queueMicrotask(() => this.dispatch(msg));
  }
  terminate() {
    this.terminated = true;
  }
  private abortedIds = new Set<number>();
  private dispatch(msg: unknown) {
    const m = msg as { kind: string; id: number; input?: InventoryAnalysisInput };
    if (m.kind === "abort") {
      this.abortedIds.add(m.id);
      return;
    }
    if (m.kind !== "analyze" || !m.input) return;
    const post = (out: unknown) => this.onmessage?.({ data: out } as MessageEvent);
    try {
      const analysis = analyzeInventory({
        ...m.input,
        onProgress: (phase, done, total) => {
          if (!this.abortedIds.has(m.id)) post({ kind: "progress", id: m.id, phase, done, total });
        },
        shouldAbort: () => this.abortedIds.has(m.id),
      });
      const wasAborted = this.abortedIds.delete(m.id);
      if (analysis && !wasAborted) post({ kind: "result", id: m.id, analysis });
      else post({ kind: "aborted", id: m.id });
    } catch {
      post({ kind: "aborted", id: m.id });
      this.abortedIds.delete(m.id);
    }
  }
}

function makeInput(): InventoryAnalysisInput {
  let s = 0;
  const id = () => `c${(s++).toString(36)}`;
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

vi.stubGlobal("Worker", FakeWorker);

describe("Client+Worker Sequenz (React-Cleanup sim)", () => {
  it("Run 1 (Effect) -> Cleanup cancel -> Run 2: beide müssen result liefern", async () => {
    const { runAnalysisAsync, terminateAnalysisWorker } = await import("../analysisClient");
    terminateAnalysisWorker();
    FakeWorker.instances = [];

    // Run 1 wie in AnalysisView: starten, dann Cleanup cancel()
    const h1 = runAnalysisAsync(makeInput());
    h1.cancel(); // Effect-Cleanup
    // Run 2: neuer Effect (z. B. Tab-Wechsel oder Re-Render mit gleicher Dep)
    const h2 = runAnalysisAsync(makeInput());

    const r1 = await h1.promise.catch((e) => e);
    const r2 = await h2.promise.then((a) => a).catch((e) => e);
    console.log("r1:", r1 instanceof Error ? `ERR ${r1.message}` : "OK result");
    console.log("r2:", r2 instanceof Error ? `ERR ${r2.message}` : "OK result");
    expect(r2).not.toBeInstanceOf(Error);
    expect((r2 as InventoryAnalysis).gearTotal).toBeGreaterThan(0);
    terminateAnalysisWorker();
  }, 300000);

  it("drei aufeinanderfolgende Runs ohne Abbruch", async () => {
    const { runAnalysisAsync, terminateAnalysisWorker } = await import("../analysisClient");
    terminateAnalysisWorker();
    FakeWorker.instances = [];
    const hs = [runAnalysisAsync(makeInput()), runAnalysisAsync(makeInput()), runAnalysisAsync(makeInput())];
    const rs = await Promise.all(hs.map((h) => h.promise.then((a) => a).catch((e: unknown) => e)));
    for (const [i, r] of rs.entries()) {
      expect(r, `run ${i + 1}`).not.toBeInstanceOf(Error);
    }
    terminateAnalysisWorker();
  }, 300000);
});
