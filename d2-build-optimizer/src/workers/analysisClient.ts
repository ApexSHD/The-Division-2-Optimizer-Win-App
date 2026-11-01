import type { InventoryAnalysis, InventoryAnalysisInput } from "../data/inventoryAnalysis";
import type { AnalysisWorkerRequest } from "./analysisWorker";

export interface AnalysisRunHandle {
  promise: Promise<InventoryAnalysis>;
  cancel: () => void;
}

interface Pending {
  resolve: (a: InventoryAnalysis) => void;
  reject: (e: unknown) => void;
}

type ProgressListener = (phase: string, done: number, total: number) => void;

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
const progressListeners = new Map<number, ProgressListener>();

function rejectAll(reason: string): void {
  for (const [, p] of pending) p.reject(new Error(reason));
  pending.clear();
  progressListeners.clear();
}

function destroyWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./analysisWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as { kind: string; id: number; phase?: string; done?: number; total?: number; analysis?: InventoryAnalysis };
      if (msg.kind === "progress") {
        progressListeners.get(msg.id)?.(msg.phase ?? "", msg.done ?? 0, msg.total ?? 0);
        return;
      }
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      progressListeners.delete(msg.id);
      if (msg.kind === "result" && msg.analysis) {
        p.resolve(msg.analysis);
      } else if (msg.kind === "aborted") {
        p.reject(new Error("Worker abgebrochen"));
      } else {
        p.reject(new Error("Worker result missing"));
      }
    };
    worker.onerror = (e) => {
      rejectAll("Worker error");
      void e;
    };
    worker.onmessageerror = () => {
      rejectAll("Worker message error");
    };
  }
  return worker;
}

function stripCallbacks(input: InventoryAnalysisInput): InventoryAnalysisInput {
  const { onProgress: _onProgress, shouldAbort: _shouldAbort, ...rest } = input;
  return rest;
}

/**
 * Startet eine Analyse im Web Worker. Es läuft immer nur EIN Run: startet ein
 * neuer Run, während noch einer aktiv ist, wird der alte Worker hart terminiert
 * (terminate wirkt sofort, auch mitten in einer synchronen Berechnung) und dessen
 * Promise mit "superseded" abgelehnt.
 */
export function runAnalysisAsync(
  input: InventoryAnalysisInput,
  onProgress?: ProgressListener,
): AnalysisRunHandle {
  if (pending.size > 0) {
    rejectAll("superseded");
    destroyWorker();
  }
  const id = nextId++;
  let w: Worker;
  try {
    w = getWorker();
  } catch (err) {
    return { promise: Promise.reject(err), cancel: () => undefined };
  }
  if (onProgress) progressListeners.set(id, onProgress);
  const promise = new Promise<InventoryAnalysis>((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
  const req: AnalysisWorkerRequest = { kind: "analyze", id, input: stripCallbacks(input) };
  try {
    w.postMessage(req);
  } catch (err) {
    pending.delete(id);
    progressListeners.delete(id);
    return { promise: Promise.reject(err), cancel: () => undefined };
  }
  return {
    promise: promise.finally(() => {
      progressListeners.delete(id);
    }),
    cancel: () => {
      const p = pending.get(id);
      pending.delete(id);
      progressListeners.delete(id);
      destroyWorker();
      p?.reject(new Error("cancelled"));
    },
  };
}

export function terminateAnalysisWorker(): void {
  rejectAll("cancelled");
  destroyWorker();
}
