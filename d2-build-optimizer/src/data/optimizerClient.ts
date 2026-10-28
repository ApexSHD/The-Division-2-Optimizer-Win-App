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
  let rejectFn: (() => void) | null = null;

  const promise = new Promise<OptimizerResult[]>((resolve, reject) => {
    rejectFn = () => reject(new Error("Abgebrochen"));
    try {
      worker = new Worker(new URL("./optimizer.worker.ts", import.meta.url), { type: "module" });
    } catch {
      // Worker-Konstruktion fehlgeschlagen: synchron rechnen wie in der Optimierer-Ansicht
      worker = null;
      import("./damage").then(({ optimizeBuilds }) => {
        if (cancelled) return finish(() => reject(new Error("Abgebrochen")));
        const results = optimizeBuilds(weapons, gear, shdLevel, settings, opts);
        cb.onProgress?.(90);
        finish(() => resolve(results));
      }).catch((err) => finish(() => reject(err)));
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
    // Watchdog: meldet sich der Worker nicht binnen 3 s UEBERHAUPT (silent hang,
    // z.B. Ladefehler im Tauri-Webview), terminieren und synchron weiterrechnen.
    const watchdog = setTimeout(() => {
      if (receivedAny || settled) return;
      try { worker?.terminate(); } catch { /* ignore */ }
      import("./damage").then(({ optimizeBuilds }) => {
        if (cancelled) return;
        const results = optimizeBuilds(weapons, gear, shdLevel, settings, opts);
        cb.onProgress?.(90);
        finish(() => resolve(results));
      }).catch((err) => finish(() => reject(err instanceof Error ? err : new Error(String(err)))));
    }, 3000);

    worker.onmessage = (e: MessageEvent) => {
      receivedAny = true;
      const msg = e.data;
      if (msg.type === "progress") cb.onProgress?.(msg.value);
      else if (msg.type === "done") {
        // FIX #78: Worker nach erfolgreichem Lauf sauber beenden
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
      // FIX #82-6: Promise beim Abbruch sauber rejected statt fuer immer offen
      rejectFn?.();
    },
  };
}
