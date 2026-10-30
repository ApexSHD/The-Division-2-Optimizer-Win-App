import type { GearPiece, GearSlot, Weapon } from "./sampleData";
import {
  optimizeV4,
  type ModeContext,
  V4_ALL_SLOTS,
} from "./operatingModes";
import { SOURCES, type SourceEntry } from "./v4Data";

export type GapStage = "A" | "B";

export interface GapRecommendation {
  rank: number;
  slot: GearSlot;
  stage: GapStage;
  description: string;
  source: SourceEntry;
  gainScore: number;
  gainPercent: number | null;
}

export interface GapAnalysisResult {
  reachabilityPercent: number | null;
  recommendations: GapRecommendation[];
  noteUpgradeExcluded: boolean;
  deterministic: true;
}

const STAGE_C_NOTE =
  "Hinweis: Umbauten (Rekalibrieren/Optimieren) werden im Prototyp nicht berücksichtigt (Lastenheft 6.3).";

function sourceForStage(gearPiece: GearPiece): SourceEntry {
  const brandLower = gearPiece.brand.toLowerCase();
  const match = SOURCES.find(
    (s) =>
      brandLower.length > 0 &&
      (s.item.toLowerCase().includes(brandLower) ||
        brandLower.includes(s.item.split(" ")[0].toLowerCase())),
  );
  if (match) return match;
  return SOURCES.find((s) => s.source_type === "targeted_farm") ?? SOURCES[0];
}

function stageForSource(source: SourceEntry): GapStage {
  return source.stage;
}

export interface GapInput {
  weapons: Weapon[];
  inventarGear: GearPiece[];
  fullGear: GearPiece[];
  ctx: ModeContext;
  opts?: {
    maxResults?: number;
    budgetPerSlot?: number;
    setBonusCatalog?: unknown;
    modsBySlot?: Record<string, { name: string; slotTypes: string[]; bonus: { type: string; val: number } | null; penalty?: { type: string; val: number } | null }[]>;
  };
}

export function analyzeGaps(input: GapInput): GapAnalysisResult {
  const inventarResult = optimizeV4(
    input.weapons,
    input.inventarGear,
    { ...input.ctx, mode: "inventar" },
    input.opts,
  );
  const zielResult = optimizeV4(
    input.weapons,
    input.fullGear,
    { ...input.ctx, mode: "ziel" },
    input.opts,
  );

  const inventarScore = inventarResult.best?.score ?? null;
  const zielScore = zielResult.best?.score ?? null;
  let reachabilityPercent: number | null = null;
  if (inventarScore !== null && zielScore !== null && zielScore > 0) {
    reachabilityPercent = (100 * inventarScore) / zielScore;
  }

  const recommendations: GapRecommendation[] = [];
  if (inventarResult.best && zielResult.best) {
    const bestGear = inventarResult.candidates.find(
      (c) => c.id === inventarResult.best!.id,
    );
    const idealGear = zielResult.candidates.find(
      (c) => c.id === zielResult.best!.id,
    );
    if (bestGear && idealGear) {
      const idealBySlot = new Map(idealGear.gear.map((g) => [g.slot, g]));
      for (const slot of V4_ALL_SLOTS) {
        const currentPiece = bestGear.gear.find((g) => g.slot === slot);
        const idealPiece = idealBySlot.get(slot);
        if (!idealPiece) continue;
        if (currentPiece && currentPiece.id === idealPiece.id) continue;
        const source = sourceForStage(idealPiece);
        recommendations.push({
          rank: 0,
          slot,
          stage: stageForSource(source),
          description: `Ersetze „${currentPiece?.brand ?? "—"} ${slot}“ durch „${idealPiece.brand} ${slot}“ — Gewinn im Gesamtwert ${(input.ctx as { __gain?: number }).__gain ?? 0}`,
          source,
          gainScore: 0,
          gainPercent: null,
        });
      }
    }
  }

  recommendations.sort((a, b) => a.slot.localeCompare(b.slot));
  recommendations.forEach((r, i) => {
    r.rank = i + 1;
  });
  const top3 = recommendations.slice(0, 3);

  return {
    reachabilityPercent,
    recommendations: top3,
    noteUpgradeExcluded: true,
    deterministic: true,
  };
}

export const GAP_STAGE_C_NOTE = STAGE_C_NOTE;
