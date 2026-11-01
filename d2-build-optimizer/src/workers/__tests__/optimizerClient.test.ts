import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { V4BuildResult } from "../../data/operatingModes";
import { runOptimizerAsync, terminateOptimizerWorker } from "../optimizerClient";

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

const fakeResult = { ranked: [], candidates: [] } as unknown as V4BuildResult;

describe("optimizerClient (CR-02 OP-3.4: eigener Worker, ein aktiver Run)", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    terminateOptimizerWorker();
  });
  afterEach(() => {
    terminateOptimizerWorker();
  });

  it("sendet optimize-Request und löst mit Ergebnis auf", async () => {
    const h = runOptimizerAsync([], [], { mode: "inventar", roleKey: "dps_krit", skills: [], teamSize: 4, shdLevel: 1000, settings: {} as never, threatStatusShare: 0.3, spec: "" });
    const w = FakeWorker.instances[0];
    const req = w.posted[0] as { kind: string; id: number };
    expect(req.kind).toBe("optimize");
    w.emit({ kind: "result", id: req.id, result: fakeResult });
    await expect(h.promise).resolves.toBe(fakeResult);
  });

  it("Fortschritt nur an eigene Run-ID", async () => {
    const seen1: string[] = [];
    const seen2: string[] = [];
    const h1 = runOptimizerAsync([], [], {} as never, undefined, (p) => seen1.push(p));
    const w1 = FakeWorker.instances[0];
    const id1 = (w1.posted[0] as { id: number }).id;
    const h2 = runOptimizerAsync([], [], {} as never, undefined, (p) => seen2.push(p));
    const w2 = FakeWorker.instances[1];
    const id2 = (w2.posted[0] as { id: number }).id;
    w1.emit({ kind: "progress", id: id1, phase: "alt", done: 1, total: 9 });
    w2.emit({ kind: "progress", id: id2, phase: "neu", done: 2, total: 9 });
    w2.emit({ kind: "result", id: id2, result: fakeResult });
    await expect(h1.promise).rejects.toThrow("superseded");
    await expect(h2.promise).resolves.toBe(fakeResult);
    expect(seen1).toEqual([]);
    expect(seen2).toEqual(["neu"]);
  });

  it("cancel() terminiert den Worker hart", async () => {
    const h = runOptimizerAsync([], [], {} as never);
    const w = FakeWorker.instances[0];
    h.cancel();
    expect(w.terminated).toBe(true);
    await expect(h.promise).rejects.toThrow("cancelled");
  });
});
