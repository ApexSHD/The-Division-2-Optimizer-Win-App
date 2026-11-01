import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { InventoryAnalysis } from "../../data/inventoryAnalysis";
import { runAnalysisAsync, terminateAnalysisWorker } from "../analysisClient";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  posted: unknown[] = [];
  terminated = false;
  constructor(_url: URL, _opts: unknown) {
    FakeWorker.instances.push(this);
  }
  postMessage(msg: unknown) {
    this.posted.push(msg);
  }
  terminate() {
    this.terminated = true;
  }
  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

vi.stubGlobal("Worker", FakeWorker);

describe("analysisClient (TA-5: Web-Worker-Wrapper, ein aktiver Run)", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    terminateAnalysisWorker();
  });
  afterEach(() => {
    terminateAnalysisWorker();
  });

  it("sendet analyze-Request und löst mit Ergebnis auf", async () => {
    const handle = runAnalysisAsync({ gear: [], weapons: [], builds: [] });
    const w = FakeWorker.instances[0];
    const req = w.posted[0] as { kind: string; id: number };
    expect(req.kind).toBe("analyze");
    const fake = { gearTotal: 0 } as unknown as InventoryAnalysis;
    w.emit({ kind: "result", id: req.id, analysis: fake });
    await expect(handle.promise).resolves.toBe(fake);
  });

  it("Progress-Events werden nur an den Listener der eigenen Run-id gemeldet", async () => {
    const seen1: Array<[string, number, number]> = [];
    const seen2: Array<[string, number, number]> = [];
    const h1 = runAnalysisAsync({ gear: [], weapons: [], builds: [] }, (p, d, t) => seen1.push([p, d, t]));
    const w1 = FakeWorker.instances[0];
    const id1 = (w1.posted[0] as { id: number }).id;
    // h1 wird von h2 verdrängt
    const h2 = runAnalysisAsync({ gear: [], weapons: [], builds: [] }, (p, d, t) => seen2.push([p, d, t]));
    const w2 = FakeWorker.instances[1];
    const id2 = (w2.posted[0] as { id: number }).id;
    w1.emit({ kind: "progress", id: id1, phase: "alt", done: 1, total: 9 });
    w2.emit({ kind: "progress", id: id2, phase: "neu", done: 2, total: 9 });
    w2.emit({ kind: "result", id: id2, analysis: { gearTotal: 1 } as unknown as InventoryAnalysis });
    await expect(h1.promise).rejects.toThrow("superseded");
    await expect(h2.promise).resolves.toBeTruthy();
    expect(seen1).toEqual([]);
    expect(seen2).toEqual([["neu", 2, 9]]);
  });

  it("cancel() terminiert den Worker hart und lehnt das Promise ab", async () => {
    const handle = runAnalysisAsync({ gear: [], weapons: [], builds: [] });
    const w = FakeWorker.instances[0];
    handle.cancel();
    expect(w.terminated).toBe(true);
    await expect(handle.promise).rejects.toThrow("cancelled");
  });

  it("neuer Run während aktiver Run terminiert den alten Worker sofort", async () => {
    const h1 = runAnalysisAsync({ gear: [], weapons: [], builds: [] });
    const w1 = FakeWorker.instances[0];
    const h2 = runAnalysisAsync({ gear: [], weapons: [], builds: [] });
    expect(w1.terminated).toBe(true);
    expect(FakeWorker.instances).toHaveLength(2);
    await expect(h1.promise).rejects.toThrow("superseded");
    const w2 = FakeWorker.instances[1];
    const id2 = (w2.posted[0] as { id: number }).id;
    w2.emit({ kind: "result", id: id2, analysis: { gearTotal: 5 } as unknown as InventoryAnalysis });
    await expect(h2.promise).resolves.toBeTruthy();
  });

  it("zwei aufeinanderfolgende Runs (sequenziell awaited) funktionieren", async () => {
    const h1 = runAnalysisAsync({ gear: [], weapons: [], builds: [] });
    const w1 = FakeWorker.instances[0];
    const id1 = (w1.posted[0] as { id: number }).id;
    w1.emit({ kind: "result", id: id1, analysis: { gearTotal: 1 } as unknown as InventoryAnalysis });
    await expect(h1.promise).resolves.toBeTruthy();
    const h2 = runAnalysisAsync({ gear: [], weapons: [], builds: [] });
    const w2 = FakeWorker.instances[FakeWorker.instances.length - 1];
    const posts2 = w2.posted.filter((m) => (m as { kind: string }).kind === "analyze");
    const id2 = (posts2[posts2.length - 1] as { id: number }).id;
    w2.emit({ kind: "result", id: id2, analysis: { gearTotal: 2 } as unknown as InventoryAnalysis });
    await expect(h2.promise).resolves.toBeTruthy();
  });
});
