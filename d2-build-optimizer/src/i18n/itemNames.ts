import attributeNamesJson from "./attributeNames.json";

export type ItemLang = "de" | "en";

interface AttrEntry {
  de: string;
  en: string;
}

interface AttributeNames {
  cores: Record<string, AttrEntry>;
  weaponAttrs: Record<string, AttrEntry>;
  gearAttrs: Record<string, AttrEntry>;
  weaponStatsExtra: Record<string, AttrEntry>;
  talentGroups: Record<string, AttrEntry>;
}

const DATA = attributeNamesJson as unknown as AttributeNames;

/**
 * Uebersetzungsschicht fuer Attribut-/Kern-Namen (DE/EN).
 * Fallback: wenn kein EN-Eintrag existiert, wird der uebergebene
 * Standard-Text (i. d. R. Deutsch) unverändert zurueckgegeben.
 */
function lookup(table: Record<string, AttrEntry>, key: string, lang: ItemLang, fallback: string): string {
  const entry = table[key];
  if (!entry) return fallback;
  return entry[lang] ?? fallback;
}

export function tCore(coreKey: string, lang: ItemLang, fallback: string): string {
  return lookup(DATA.cores, coreKey, lang, fallback);
}

export function tWeaponAttr(attrKey: string, lang: ItemLang, fallback: string): string {
  return (
    DATA.weaponAttrs[attrKey]?.[lang] ??
    DATA.weaponStatsExtra[attrKey]?.[lang] ??
    DATA.gearAttrs[attrKey]?.[lang] ??
    fallback
  );
}

export function tGearAttr(attrKey: string, lang: ItemLang, fallback: string): string {
  return (
    DATA.gearAttrs[attrKey]?.[lang] ??
    DATA.weaponAttrs[attrKey]?.[lang] ??
    DATA.weaponStatsExtra[attrKey]?.[lang] ??
    fallback
  );
}

export function tTalentGroup(group: string, lang: ItemLang, fallback: string): string {
  return lookup(DATA.talentGroups, group, lang, fallback);
}

/**
 * Waffen-/Gear-/Talent-NAMEN: Platzhalter bis die zugehoerigen
 * Namens-Listen des Auftraggebers vorliegen (siehe itemNames-Struktur).
 * Der mechanismus greift spaeter auf dieselbe Fallback-Logik zurueck.
 */
const ITEM_NAMES: Record<string, AttrEntry> = {};

export function tItemName(kind: "weapon" | "gear" | "talent", id: string, lang: ItemLang, fallback: string): string {
  const entry = ITEM_NAMES[`${kind}:${id.toLowerCase()}`];
  if (!entry) return fallback;
  return entry[lang] ?? fallback;
}
