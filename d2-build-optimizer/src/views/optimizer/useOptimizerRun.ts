import { useCallback, useRef, useState } from "react";
import { optimizeV4, type ModeContext, type V4BuildResult } from "../../data/operatingModes";
import { runOptimizerAsync } from "../../workers/optimizerClient";
import type { Weapon, GearPiece } from "../../data/sampleData";

export interface OptimizerRunState {
  running: boolean;
  cancelled: boolean;
  progress: { phase: string; done: number; total: number } | null;
  result: V4BuildResult | null;
  error: string | null;
}

export function useOptimizerRun() {
  const [state, setState] = useState<OptimizerRunState>({
    running: false,
    cancelled: false,
    progress: null,
    result: null,
    error: null,
  });
  const handleRef = useRef<ReturnType<typeof runOptimizerAsync> | null>(null);
  const generationRef = useRef(0);

  const run = useCallback(
    (
      weapons: Weapon[],
      gear: GearPiece[],
      ctx: ModeContext,
      opts?: { maxResults?: number; setBonusCatalog?: unknown; modsBySlot?: unknown },
    ) => {
      const generation = ++generationRef.current;
      handleRef.current?.cancel();
      handleRef.current = null;
      setState({ running: true, cancelled: false, progress: null, result: null, error: null });
      const handle = runOptimizerAsync(
        weapons,
        gear,
        ctx,
        { maxResults: opts?.maxResults, setBonusCatalog: opts?.setBonusCatalog, modsBySlot: opts?.modsBySlot },
        (phase, done, total) => {
          if (generation !== generationRef.current) return;
          setState((s) => ({ ...s, progress: { phase, done, total } }));
        },
      );
      handleRef.current = handle;
      handle.promise
        .then((result) => {
          if (generation !== generationRef.current) return;
          setState({ running: false, cancelled: false, progress: null, result, error: null });
        })
        .catch((err: unknown) => {
          if (generation !== generationRef.current) return;
          if (err instanceof Error && (err.message === "cancelled" || err.message === "superseded")) {
            setState((s) => ({ ...s, running: false, cancelled: true }));
            return;
          }
          const fallback = optimizeV4(weapons, gear, ctx, {
            maxResults: opts?.maxResults,
            setBonusCatalog: opts?.setBonusCatalog,
            modsBySlot: opts?.modsBySlot as never,
          });
          setState({ running: false, cancelled: false, progress: null, result: fallback, error: "worker-fallback" });
        });
    },
    [],
  );

  const cancel = useCallback(() => {
    generationRef.current += 1;
    handleRef.current?.cancel();
    handleRef.current = null;
    setState((s) => ({ ...s, running: false, cancelled: true }));
  }, []);

  return { ...state, run, cancel };
}
