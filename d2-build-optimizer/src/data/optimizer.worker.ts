import type { OptimizationSettings } from "../store";
import type { Weapon, GearPiece } from "./sampleData";
import type { SetBonusCatalog, OptimizerResult } from "./damage";

export interface OptimizerWorkerRequest {
  weapons: Weapon[];
  gear: GearPiece[];
  shdLevel: number;
  settings: OptimizationSettings;
  opts: {
    gearSetNames: string[];
    maxResults: number;
    spec: string;
    modsBySlot: Record<string, { name: string; slotTypes: string[]; bonus: { type: string; val: number } | null; penalty?: { type: string; val: number } | null }[]> | undefined;
    setBonusCatalog: SetBonusCatalog | null;
  };
}

self.onmessage = (e: MessageEvent<OptimizerWorkerRequest>) => {
  const { weapons, gear, shdLevel, settings, opts } = e.data;
  self.postMessage({ type: "progress", value: 15 });
  import("./damage").then(({ optimizeBuilds }) => {
    try {
      const results = optimizeBuilds(weapons, gear, shdLevel, settings, opts) as OptimizerResult[];
      self.postMessage({ type: "progress", value: 90 });
      self.postMessage({ type: "done", results });
    } catch (err) {
      self.postMessage({ type: "error", message: String(err) });
    }
  });
};
