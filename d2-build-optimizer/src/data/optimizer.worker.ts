import type { OptimizerResult } from "./damage";
import type { OptimizerWorkerRequest } from "./optimizerClient";

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
