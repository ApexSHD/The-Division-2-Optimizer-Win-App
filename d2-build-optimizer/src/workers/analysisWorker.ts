import { analyzeInventory, type InventoryAnalysisInput } from "../data/inventoryAnalysis";

export interface AnalysisWorkerRequest {
  kind: "analyze";
  id: number;
  input: InventoryAnalysisInput;
}

export interface AnalysisWorkerProgress {
  kind: "progress";
  id: number;
  phase: string;
  done: number;
  total: number;
}

export interface AnalysisWorkerResult {
  kind: "result";
  id: number;
  analysis: ReturnType<typeof analyzeInventory>;
}

export interface AnalysisWorkerAborted {
  kind: "aborted";
  id: number;
}

type Outgoing = AnalysisWorkerProgress | AnalysisWorkerResult | AnalysisWorkerAborted;

const abortedIds = new Set<number>();

self.onmessage = (ev: MessageEvent<AnalysisWorkerRequest | { kind: "abort"; id: number }>) => {
  const msg = ev.data;
  if (msg.kind === "abort") {
    abortedIds.add(msg.id);
    return;
  }
  if (msg.kind !== "analyze") return;
  const post = (m: Outgoing) => (self as unknown as Worker).postMessage(m);
  try {
    const analysis = analyzeInventory({
      ...msg.input,
      onProgress: (phase, done, total) => {
        if (!abortedIds.has(msg.id)) post({ kind: "progress", id: msg.id, phase, done, total });
      },
      shouldAbort: () => abortedIds.has(msg.id),
    });
    abortedIds.delete(msg.id);
    if (abortedIds.size === 0 && analysis) {
      post({ kind: "result", id: msg.id, analysis });
    } else {
      post({ kind: "aborted", id: msg.id });
    }
  } catch {
    post({ kind: "aborted", id: msg.id });
    abortedIds.delete(msg.id);
  }
};
