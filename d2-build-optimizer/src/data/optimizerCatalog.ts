import { useEffect, useState } from "react";
import type { SetBonusCatalog } from "./damage";
import { getDb } from "./db";
import type { Db, GearSetItemPreset } from "./db";

export type ModSlotsBySlot = Db["modSlots"];

export interface OptimizerCatalog {
  gearSets: GearSetItemPreset[];
  modSlots: ModSlotsBySlot | null;
  setBonusCatalog: SetBonusCatalog | null;
}

export function useOptimizerCatalog(): OptimizerCatalog {
  const [gearSets, setGearSets] = useState<GearSetItemPreset[]>([]);
  const [setBonusCatalog, setSetBonusCatalog] = useState<SetBonusCatalog | null>(null);
  const [modSlots, setModSlots] = useState<ModSlotsBySlot | null>(null);

  useEffect(() => {
    getDb()
      .then((db) => {
        setGearSets(db.gearSetItems);
        setModSlots(db.modSlots);
        const brands: Record<string, Record<string, Record<string, unknown>>> = {};
        for (const b of db.brandSets) brands[b.key] = b.numericBonusesPve ?? {};
        const greens: Record<string, Record<string, { attr: string; val: number }[]>> = {};
        for (const g of db.gearSets) greens[g.key] = g.numericBonuses ?? {};
        setSetBonusCatalog({ brands, greens });
      })
      .catch(() => setGearSets([]));
  }, []);

  return { gearSets, modSlots, setBonusCatalog };
}

export function optimizerRunOptions(
  catalog: OptimizerCatalog,
  spec: string,
  maxResults = 10,
): { gearSetNames: string[]; maxResults: number; spec: string; modsBySlot?: ModSlotsBySlot; setBonusCatalog: SetBonusCatalog | null } {
  return {
    gearSetNames: catalog.gearSets.map((gs) => gs.name),
    maxResults,
    spec,
    modsBySlot: catalog.modSlots ?? undefined,
    setBonusCatalog: catalog.setBonusCatalog,
  };
}
