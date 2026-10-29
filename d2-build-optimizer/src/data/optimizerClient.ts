import type { OptimizerResult, SetBonusCatalog } from "./damage";
import type { OptimizationSettings } from "../store";
import type { Weapon, GearPiece } from "./sampleData";

export interface OptimizerRunOptions {
  gearSetNames: string[];
  maxResults: number;
  spec: string;
  modsBySlot?: Record<string, { name: string; slotTypes: string[]; bonus: { type: string; val: number } | null; penalty?: { type: string; val: number } | null }[]>;
  setBonusCatalog: SetBonusCatalog | null;
}

export interface OptimizerWorkerRequest {
  weapons: Weapon[];
  gear: GearPiece[];
  shdLevel: number;
  settings: OptimizationSettings;
  opts: OptimizerRunOptions;
}

export type OptimizerProgress = (pct: number) => void;

function runSync(
  weapons: Weapon[],
  gear: GearPiece[],
  shdLevel: number,
  settings: OptimizationSettings,
  opts: OptimizerRunOptions,
  onProgress?: OptimizerProgress,
): Promise<OptimizerResult[]> {
  return import("./damage").then(({ optimizeBuilds }) => {
    const results = optimizeBuilds(weapons, gear, shdLevel, settings, opts);
    onProgress?.(90);
    return results;
  });
}

export function runOptimizerAsync(
  weapons: Weapon[],
  gear: GearPiece[],
  shdLevel: number,
  settings: OptimizationSettings,
  opts: OptimizerRunOptions,
  cb: { onProgress?: OptimizerProgress } = {},
): { promise: Promise<OptimizerResult[]>; cancel: () => void } {
  let worker: Worker | null = null;
  let cancelled = false;
  let rejectFn: (() => void) | null = null;

  const promise = new Promise<OptimizerResult[]>((resolve, reject) => {
    rejectFn = () => reject(new Error("Abgebrochen"));
    try {
      worker = new Worker(new URL("./optimizer.worker.ts", import.meta.url), { type: "module" });
    } catch {
      worker = null;
      runSync(weapons, gear, shdLevel, settings, opts, cb.onProgress)
        .then((results) => {
          if (!cancelled) resolve(results);
        })
        .catch(reject);
      return;
    }

    let receivedAny = false;
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      fn();
    };
    const watchdog = setTimeout(() => {
      if (receivedAny || settled) return;
      try { worker?.terminate(); } catch { /* ignore */ }
      runSync(weapons, gear, shdLevel, settings, opts, cb.onProgress)
        .then((results) => {
          if (!cancelled) resolve(results);
        })
        .catch((err) => finish(() => reject(err instanceof Error ? err : new Error(String(err)))));
    }, 3000);

    worker.onmessage = (e: MessageEvent) => {
      receivedAny = true;
      const msg = e.data;
      if (msg.type === "progress") cb.onProgress?.(msg.value);
      else if (msg.type === "done") {
        finish(() => resolve(msg.results as OptimizerResult[]));
        worker?.terminate();
      } else if (msg.type === "error") {
        finish(() => reject(new Error(msg.message)));
        worker?.terminate();
      }
    };
    worker.onerror = (err) => {
      finish(() => reject(new Error(String(err))));
      worker?.terminate();
    };

    const req: OptimizerWorkerRequest = { weapons, gear, shdLevel, settings, opts };
    worker.postMessage(req);
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      worker?.terminate();
      rejectFn?.();
    },
  };
}
