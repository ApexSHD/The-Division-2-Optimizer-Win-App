import type { InventoryAnalysis, InventoryAnalysisInput } from "../data/inventoryAnalysis";
import type { AnalysisWorkerRequest } from "./analysisWorker";

export interface AnalysisRunHandle {
  promise: Promise<InventoryAnalysis>;
  cancel: () => void;
  /** true, wenn der Worker die Berechnung nicht zu Ende führen konnte (z. B. Absturz/Abbruch). */
  partial: () => boolean;
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
      } else if (msg.kind === "aborted") {
        p.reject(new Error("Worker abgebrochen"));
      } else {
        p.reject(new Error("Worker result missing"));
      }
    };
    worker.onerror = (e) => {
      for (const [, p] of pending) p.reject(e instanceof Error ? e : new Error("Worker error"));
      pending.clear();
    };
    worker.onmessageerror = () => {
      for (const [, p] of pending) p.reject(new Error("Worker message error"));
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
  let w: Worker;
  try {
    w = getWorker();
  } catch (err) {
    return {
      promise: Promise.reject(err),
      cancel: () => undefined,
      partial: () => true,
    };
  }
  if (onProgress) listeners.add(onProgress);
  let partialResult = false;
  const promise = new Promise<InventoryAnalysis>((resolve, reject) => {
    pending.set(id, { resolve, reject, cancelled: false });
  });
  const req: AnalysisWorkerRequest = { kind: "analyze", id, input: stripCallbacks(input) };
  try {
    w.postMessage(req);
  } catch (err) {
    pending.delete(id);
    if (onProgress) listeners.delete(onProgress);
    return {
      promise: Promise.reject(err),
      cancel: () => undefined,
      partial: () => true,
    };
  }
  return {
    promise: promise.finally(() => {
      if (onProgress) listeners.delete(onProgress);
    }),
    cancel: () => {
      const p = pending.get(id);
      if (p) p.cancelled = true;
      w.postMessage({ kind: "abort", id });
    },
    partial: () => partialResult,
  };
}

function stripCallbacks(input: InventoryAnalysisInput): InventoryAnalysisInput {
  const { onProgress: _onProgress, shouldAbort: _shouldAbort, ...rest } = input;
  return rest;
}

export function terminateAnalysisWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  pending.clear();
  listeners.clear();
}
