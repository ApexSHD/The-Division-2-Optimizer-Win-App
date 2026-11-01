import type { ModeContext, V4BuildResult } from "../data/operatingModes";
import type { Weapon, GearPiece } from "../data/sampleData";
import type { OptimizerWorkerRequest } from "./optimizerWorker";

export interface OptimizerRunHandle {
  promise: Promise<V4BuildResult>;
  cancel: () => void;
}

interface Pending {
  resolve: (r: V4BuildResult) => void;
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
    worker = new Worker(new URL("./optimizerWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as { kind: string; id: number; phase?: string; done?: number; total?: number; result?: V4BuildResult };
      if (msg.kind === "progress") {
        progressListeners.get(msg.id)?.(msg.phase ?? "", msg.done ?? 0, msg.total ?? 0);
        return;
      }
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      progressListeners.delete(msg.id);
      if (msg.kind === "result" && msg.result) {
        p.resolve(msg.result);
      } else {
        p.reject(new Error("Worker result missing"));
      }
    };
    worker.onerror = () => {
      rejectAll("Worker error");
    };
    worker.onmessageerror = () => {
      rejectAll("Worker message error");
    };
  }
  return worker;
}

/**
 * Führt optimizeV4 in einem eigenen Web Worker aus. Es läuft immer nur EIN Run:
 * ein neuer Run terminiert den alten Worker sofort (terminate), dessen Promise
 * wird mit "superseded" abgelehnt. cancel() beendet den aktiven Run hart.
 */
export function runOptimizerAsync(
  weapons: Weapon[],
  gear: GearPiece[],
  ctx: ModeContext,
  opts?: OptimizerWorkerRequest["opts"],
  onProgress?: ProgressListener,
): OptimizerRunHandle {
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
  const promise = new Promise<V4BuildResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
  try {
    w.postMessage({ kind: "optimize", id, weapons, gear, ctx, opts } satisfies OptimizerWorkerRequest);
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

export function terminateOptimizerWorker(): void {
  rejectAll("cancelled");
  destroyWorker();
}
