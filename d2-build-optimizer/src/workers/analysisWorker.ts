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

type Outgoing = AnalysisWorkerProgress | AnalysisWorkerResult;

self.onmessage = (ev: MessageEvent<AnalysisWorkerRequest>) => {
  const msg = ev.data;
  if (msg.kind !== "analyze") return;
  const post = (m: Outgoing) => (self as unknown as Worker).postMessage(m);
  const analysis = analyzeInventory({
    ...msg.input,
    onProgress: (phase, done, total) => post({ kind: "progress", id: msg.id, phase, done, total }),
    shouldAbort: () => false,
  });
  post({ kind: "result", id: msg.id, analysis });
};
