import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { InventoryAnalysis } from "../../data/inventoryAnalysis";
import { runAnalysisAsync, terminateAnalysisWorker } from "../analysisClient";

class FakeWorker {
  static last: FakeWorker | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  posted: unknown[] = [];
  terminated = false;
  constructor(_url: URL, _opts: unknown) {
    FakeWorker.last = this;
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

describe("analysisClient (TA-5: Web-Worker-Wrapper)", () => {
  beforeEach(() => {
    FakeWorker.last = null;
    terminateAnalysisWorker();
  });
  afterEach(() => {
    terminateAnalysisWorker();
  });

  it("sendet analyze-Request und löst mit Ergebnis auf", async () => {
    const handle = runAnalysisAsync({ gear: [], weapons: [], builds: [] });
    const w = FakeWorker.last!;
    expect(w).toBeTruthy();
    const req = w.posted[0] as { kind: string; id: number };
    expect(req.kind).toBe("analyze");
    const id = req.id;
    const fake = { gearTotal: 0 } as unknown as InventoryAnalysis;
    w.emit({ kind: "result", id, analysis: fake });
    await expect(handle.promise).resolves.toBe(fake);
  });

  it("Progress-Events werden an den Listener gemeldet", async () => {
    const seen: Array<[string, number, number]> = [];
    const handle = runAnalysisAsync({ gear: [], weapons: [], builds: [] }, (phase, done, total) => {
      seen.push([phase, done, total]);
    });
    const w = FakeWorker.last!;
    const req2 = w.posted[0] as { kind: string; id: number };
    w.emit({ kind: "progress", id: req2.id, phase: "beam", done: 3, total: 6 });
    w.emit({ kind: "result", id: req2.id, analysis: { gearTotal: 1 } as unknown as InventoryAnalysis });
    await handle.promise;
    expect(seen).toEqual([["beam", 3, 6]]);
  });

  it("cancel() sendet abort und lehnt das Promise ab", async () => {
    const handle = runAnalysisAsync({ gear: [], weapons: [], builds: [] });
    const w = FakeWorker.last!;
    handle.cancel();
    const req3 = w.posted[0] as { kind: string; id: number };
    expect(w.posted[1]).toMatchObject({ kind: "abort", id: req3.id });
    w.emit({ kind: "aborted", id: req3.id });
    await expect(handle.promise).rejects.toThrow("cancelled");
  });
});
