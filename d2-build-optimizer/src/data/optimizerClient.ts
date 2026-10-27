import type { OptimizerResult } from "./damage";
import type { OptimizationSettings } from "../store";
import type { Weapon, GearPiece } from "./sampleData";
import type { SetBonusCatalog } from "./damage";

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

export interface OptimizerProgress {
  onProgress?: (pct: number) => void;
}

export function runOptimizerAsync(
  weapons: Weapon[],
  gear: GearPiece[],
  shdLevel: number,
  settings: OptimizationSettings,
  opts: OptimizerRunOptions,
  cb: { onProgress?: (pct: number) => void } = {},
): { promise: Promise<OptimizerResult[]>; cancel: () => void } {
  let worker: Worker | null = null;
  let cancelled = false;

  const promise = new Promise<OptimizerResult[]>((resolve, reject) => {
    try {
      worker = new Worker(new URL("./optimizer.worker.ts", import.meta.url), { type: "module" });
    } catch {
      import("./damage").then(({ optimizeBuilds }) => {
        if (cancelled) return reject(new Error("Abgebrochen"));
        const results = optimizeBuilds(weapons, gear, shdLevel, settings, opts);
        resolve(results);
      }).catch(reject);
      return;
    }

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === "progress") cb.onProgress?.(msg.value);
      else if (msg.type === "done") resolve(msg.results as OptimizerResult[]);
      else if (msg.type === "error") reject(new Error(msg.message));
    };
    worker.onerror = (err) => reject(new Error(String(err)));

    const req: OptimizerWorkerRequest = { weapons, gear, shdLevel, settings, opts };
    worker.postMessage(req);
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      worker?.terminate();
    },
  };
}
