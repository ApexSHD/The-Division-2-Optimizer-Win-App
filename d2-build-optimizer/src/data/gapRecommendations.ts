import type { GearPiece, GearSlot, Weapon } from "./sampleData";
import type { ModeContext } from "./operatingModes";
import { axisContextFor, defaultSetBonusCatalog, optimizeV4, V4_ALL_SLOTS } from "./operatingModes";
import { computeEffectVector, vectorToRecord } from "./axes";
import { enemyProfileFromSettings, evaluateBuild } from "./damage";
import { normalizeAxes, roleProfile, scoreBuild } from "./roleProfiles";
import type { AxisKey } from "./v4Data";
import type { GapRecommendationEntry } from "./inventoryAnalysis";
import { sourceForItem } from "./inventoryAnalysis";

export interface GapComputationInput {
  weapons: Weapon[];
  inventarGear: GearPiece[];
  fullGear: GearPiece[];
  ctx: ModeContext;
  roleKey: string;
  onProgress?: (phase: string, done: number, total: number) => void;
  shouldAbort?: () => boolean;
}

/**
 * Echte Nutzen-Empfehlungen (CR-02 OP-4.7/OP-6.1, FA-6): je Slot wird der Gewinn
 * berechnet, den das Ziel-Teil aus dem vollen DB-Pool im besten Inventar-Build
 * erzeugen würde. Sortiert nach Gewinn absteigend, mit Bezugsquelle aus sources.json.
 * Gemeinsame Logik für Inventaranalyse („Lücken“) und Optimierer („Verbesserungen“).
 */
export function computeGapRecommendations(input: GapComputationInput): GapRecommendationEntry[] {
  const { ctx, roleKey } = input;
  const role = roleProfile(roleKey);
  const inv = optimizeV4(
    input.weapons,
    input.inventarGear,
    { ...ctx, roleKey, mode: "inventar" },
    { maxResults: 50, budgetPerSlot: 25, beamWidth: 4000, onProgress: input.onProgress, shouldAbort: input.shouldAbort },
  );
  if (input.shouldAbort?.()) return [];
  const invTopWeapon = inv.candidates[0]?.weapon ?? input.weapons[0];
  const ziel = optimizeV4(
    [invTopWeapon],
    input.fullGear,
    { ...ctx, roleKey, mode: "ziel" },
    { maxResults: 50, budgetPerSlot: 25, beamWidth: 4000, onProgress: input.onProgress, shouldAbort: input.shouldAbort },
  );
  if (input.shouldAbort?.()) return [];

  const invBest = inv.best ?? inv.ranked[0] ?? null;
  const zielBest = ziel.best ?? ziel.ranked[0] ?? null;
  if (!invBest || !zielBest || inv.candidates.length === 0 || ziel.candidates.length === 0) return [];

  const invCand = inv.candidates.find((c) => c.id === invBest.id) ?? inv.candidates[0];
  const zielCand = ziel.candidates.find((c) => c.id === zielBest.id) ?? ziel.candidates[0];
  const zielBySlot = new Map(zielCand.gear.map((g) => [g.slot, g]));
  const invWeaponId = invCand.weapon.id;
  const invVecs = inv.candidates.filter((c) => c.weapon.id === invWeaponId).map((c) => vectorToRecord(c.vector));
  const zielVecs = ziel.candidates.filter((c) => c.weapon.id === invWeaponId).map((c) => vectorToRecord(c.vector));

  const hybridVectors: Record<AxisKey, number>[] = [];
  const slots: GearSlot[] = [];
  const ideals: GearPiece[] = [];
  for (const slot of V4_ALL_SLOTS) {
    const current = invCand.gear.find((g) => g.slot === slot);
    const ideal = zielBySlot.get(slot);
    if (!ideal || !current || current.id === ideal.id) continue;
    const withIdeal = invCand.gear.map((g) => (g.slot === slot ? ideal : g));
    const { damage: hybridDamage } = evaluateBuild(invCand.weapon, withIdeal, {
      shdLevel: ctx.shdLevel,
      profile: enemyProfileFromSettings(ctx.settings),
      spec: ctx.spec,
      setBonusCatalog: defaultSetBonusCatalog(),
    });
    const hybridDps = ctx.settings.targetMetric === "burst" ? hybridDamage.effectiveDps : hybridDamage.sustainedDps;
    const v = computeEffectVector(axisContextFor(withIdeal, hybridDps, ctx, role));
    hybridVectors.push(vectorToRecord(v));
    slots.push(slot);
    ideals.push(ideal);
  }

  const allVectors = [...zielVecs, ...invVecs, ...hybridVectors, vectorToRecord(invCand.vector)];
  const normalized = normalizeAxes(allVectors);
  const invScoreNorm = scoreBuild(role, normalized[normalized.length - 1]);
  const entries: GapRecommendationEntry[] = [];
  for (let i = 0; i < slots.length; i++) {
    const hybridIdx = zielVecs.length + invVecs.length + i;
    const gainScore = scoreBuild(role, normalized[hybridIdx]) - invScoreNorm;
    if (!Number.isFinite(gainScore) || gainScore <= 1e-9) continue;
    const gainPercent = invScoreNorm > 0 ? (100 * gainScore) / invScoreNorm : null;
    const src = sourceForItem(ideals[i].brand);
    entries.push({
      rank: 0,
      slot: slots[i],
      targetName: ideals[i].brand,
      targetBrand: ideals[i].brand,
      gainPercent: gainPercent === null ? null : Math.round(gainPercent * 10) / 10,
      gainScore: Math.round(gainScore * 100) / 100,
      source: src,
      stage: src.stage,
    });
  }
  entries.sort((a, b) => (b.gainPercent ?? -1) - (a.gainPercent ?? -1));
  entries.forEach((e, i) => {
    e.rank = i + 1;
  });
  return entries;
}
