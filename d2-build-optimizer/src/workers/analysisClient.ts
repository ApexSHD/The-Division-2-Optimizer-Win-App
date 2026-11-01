import type { InventoryAnalysis, InventoryAnalysisInput } from "../data/inventoryAnalysis";
import type { AnalysisWorkerRequest } from "./analysisWorker";

export interface AnalysisRunHandle {
  promise: Promise<InventoryAnalysis>;
  cancel: () => void;
}

interface Pending {
  resolve: (a: InventoryAnalysis) => void;
  reject: (e: unknown) => void;
  cancelled: boolean;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
const listeners = new Set<(phase: string, done: number, total: number) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./analysisWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as { kind: string; id: number; phase?: string; done?: number; total?: number; analysis?: InventoryAnalysis };
      if (msg.kind === "progress") {
        for (const l of listeners) l(msg.phase ?? "", msg.done ?? 0, msg.total ?? 0);
        return;
      }
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.kind === "result" && msg.analysis) {
        p.resolve(msg.analysis);
      } else if (p.cancelled && msg.kind === "aborted") {
        p.reject(new Error("cancelled"));
      } else {
        p.reject(new Error("Worker result missing"));
      }
    };
    worker.onerror = (e) => {
      for (const [, p] of pending) p.reject(e instanceof Error ? e : new Error("Worker error"));
      pending.clear();
    };
  }
  return worker;
}

export function runAnalysisAsync(
  input: InventoryAnalysisInput,
  onProgress?: (phase: string, done: number, total: number) => void,
): AnalysisRunHandle {
  const id = nextId++;
  const w = getWorker();
  if (onProgress) listeners.add(onProgress);
  const promise = new Promise<InventoryAnalysis>((resolve, reject) => {
    pending.set(id, { resolve, reject, cancelled: false });
  });
  const req: AnalysisWorkerRequest = { kind: "analyze", id, input };
  w.postMessage(req);
  return {
    promise: promise.finally(() => {
      if (onProgress) listeners.delete(onProgress);
    }),
    cancel: () => {
      const p = pending.get(id);
      if (p) p.cancelled = true;
      w.postMessage({ kind: "abort", id });
    },
  };
}

export function terminateAnalysisWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  pending.clear();
  listeners.clear();
}
