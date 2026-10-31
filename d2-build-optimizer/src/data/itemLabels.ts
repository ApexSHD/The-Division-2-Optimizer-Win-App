import type { GearPiece, Weapon, GearAttrKey } from "./sampleData";
import { GEAR_CORE_LABELS } from "./sampleData";

const SLOT_SHORT: Record<string, string> = {
  mask: "Maske",
  chest: "Weste",
  holster: "Holster",
  backpack: "Rucksack",
  gloves: "Handschuhe",
  kneepads: "Knieschoner",
};

const GEAR_ATTR_SHORT: Record<GearAttrKey, string> = {
  chc: "CHC",
  chd: "CHD",
  hsd: "HSD",
  wd: "WD",
  dta: "DTA",
  dth: "DTH",
  dttooc: "DTToOC",
  wh: "Handling",
  armorregen: "Rüst.Reg.",
  explres: "Expl.Res.",
  hazard: "Gefahrensch.",
  health: "HP",
  skilldmg: "Skill-Sch.",
  skillhaste: "Skill-Eile",
  repair: "Reparatur",
  status: "Status",
  aok: "AoK",
  rof: "Feuerrate",
  incomrepair: "Eingeh. Rep.",
};

/**
 * INV-4: Eindeutiges, automatisch erzeugtes Kurzlabel für ein Gear-Teil.
 * Marke + Slot + Kern + Attribute — identische Teile bleiben unterscheidbar,
 * da die Attributwerte im Label stehen.
 */
export function gearShortLabel(g: GearPiece): string {
  const attrs = g.attributes
    .map((a) => `${GEAR_ATTR_SHORT[a.type] ?? a.type} ${a.value.toLocaleString("de-DE", { maximumFractionDigits: 1 })}`)
    .join(" / ");
  const core =
    g.core === "skill"
      ? `${GEAR_CORE_LABELS[g.core]} ${g.coreValue}`
      : `${GEAR_CORE_LABELS[g.core]} ${g.coreValue.toLocaleString("de-DE", { maximumFractionDigits: 1 })}`;
  return [g.brand, SLOT_SHORT[g.slot] ?? g.slot, core, attrs].filter(Boolean).join(" · ");
}

export function weaponShortLabel(w: Weapon): string {
  const parts = [w.name, w.type.toUpperCase()];
  if (w.talent) parts.push(w.talent);
  if (w.isPrototype) parts.push("Prototyp");
  return parts.join(" · ");
}

/**
 * Wertefingerabdruck für Duplikat-Erkennung (ohne id — zwei Teile mit gleichem
 * Fingerprint sind inhaltlich identisch).
 */
export function gearValueFingerprint(g: GearPiece): string {
  return [
    g.slot,
    g.brand,
    g.brandType,
    g.core,
    g.coreValue,
    g.attributes.map((a) => `${a.type}:${a.value}`).join(","),
    g.talent ?? "",
    g.prototype ? 1 : 0,
    g.mod ? `${g.mod.attr}:${g.mod.value}` : "",
  ].join("|");
}

export interface DuplicateInfo {
  duplicateIds: Set<string>;
  counts: Map<string, number>;
}

export function findGearDuplicates(gear: GearPiece[]): DuplicateInfo {
  const counts = new Map<string, number>();
  for (const g of gear) {
    const fp = gearValueFingerprint(g);
    counts.set(fp, (counts.get(fp) ?? 0) + 1);
  }
  const duplicateIds = new Set<string>();
  for (const g of gear) {
    if ((counts.get(gearValueFingerprint(g)) ?? 0) > 1) duplicateIds.add(g.id);
  }
  return { duplicateIds, counts };
}
