import { optimizeV4, type ModeContext, type V4BuildResult } from "../data/operatingModes";
import type { Weapon, GearPiece } from "../data/sampleData";

export interface OptimizerWorkerRequest {
  kind: "optimize";
  id: number;
  weapons: Weapon[];
  gear: GearPiece[];
  ctx: ModeContext;
  opts?: {
    maxResults?: number;
    budgetPerSlot?: number;
    beamWidth?: number;
    setBonusCatalog?: unknown;
    modsBySlot?: unknown;
  };
}

export interface OptimizerWorkerProgress {
  kind: "progress";
  id: number;
  phase: string;
  done: number;
  total: number;
}

export interface OptimizerWorkerResult {
  kind: "result";
  id: number;
  result: V4BuildResult;
}

type Outgoing = OptimizerWorkerProgress | OptimizerWorkerResult;

self.onmessage = (ev: MessageEvent<OptimizerWorkerRequest>) => {
  const msg = ev.data;
  if (msg.kind !== "optimize") return;
  const post = (m: Outgoing) => (self as unknown as Worker).postMessage(m);
  const result = optimizeV4(msg.weapons, msg.gear, msg.ctx, {
    maxResults: msg.opts?.maxResults,
    budgetPerSlot: msg.opts?.budgetPerSlot,
    beamWidth: msg.opts?.beamWidth,
    setBonusCatalog: msg.opts?.setBonusCatalog as never,
    modsBySlot: msg.opts?.modsBySlot as never,
    onProgress: (phase, done, total) => post({ kind: "progress", id: msg.id, phase, done, total }),
    shouldAbort: () => false,
  });
  post({ kind: "result", id: msg.id, result });
};
