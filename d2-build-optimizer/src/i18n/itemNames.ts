import attributeNamesJson from "./attributeNames.json";
import talentNamesJson from "./talentNames.json";
import weaponNamesJson from "./weaponNames.json";
import gearSetNamesJson from "./gearSetNames.json";
import gearDbJson from "../db/gear.json";

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
 * Set-Bonus-Attribute (Brand-/Gear-Sets, z. B. hsd, rof, wd_by_weapon):
 * durchsucht alle Attribut-Tabellen inkl. Cores.
 */
export interface AttrNameOverride {
  de?: string;
  en?: string;
}

export function tSetBonusAttr(
  attrKey: string,
  lang: ItemLang,
  fallback: string,
  overrides?: Record<string, AttrNameOverride | null>,
): string {
  const o = overrides?.[attrKey];
  if (o && typeof o === "object" && o[lang]) return o[lang] as string;
  return (
    DATA.gearAttrs[attrKey]?.[lang] ??
    DATA.weaponAttrs[attrKey]?.[lang] ??
    DATA.weaponStatsExtra[attrKey]?.[lang] ??
    DATA.cores[attrKey]?.[lang] ??
    fallback
  );
}

/** Rohe DE/EN-Eintraege eines Set-Bonus-Attributs ( fuer den Attribut-Stamm im Admin-Bereich). */
export function setBonusAttrEntry(attrKey: string): AttrEntry | null {
  return (
    DATA.gearAttrs[attrKey] ??
    DATA.weaponAttrs[attrKey] ??
    DATA.weaponStatsExtra[attrKey] ??
    DATA.cores[attrKey] ??
    null
  );
}

/**
 * Talent-Namen (DE-DB-Label -> EN), Auftraggeber-Liste 2 + talent.json-Namen.
 * Waffen-/Gear-NAMEN folgen als weitere Listen.
 */
const TALENT_NAMES = talentNamesJson as unknown as Record<string, AttrEntry>;

export function tTalentName(deLabel: string, lang: ItemLang, fallback: string): string {
  const entry = TALENT_NAMES[deLabel];
  if (!entry) return fallback;
  return entry[lang] ?? fallback;
}

const WEAPON_NAMES: Record<string, AttrEntry> = (() => {
  const out: Record<string, AttrEntry> = {};
  const file = weaponNamesJson as unknown as Record<string, Record<string, AttrEntry>>;
  for (const list of Object.values(file)) {
    if (typeof list !== "object" || list === null) continue;
    for (const [key, entry] of Object.entries(list)) {
      if (entry && typeof entry === "object" && "de" in entry && "en" in entry) {
        out[key] = entry;
      }
    }
  }
  return out;
})();

export function tWeaponName(dbName: string, lang: ItemLang, fallback: string): string {
  // Exakte Suche, dann Basisname ohne Klammerzusatz
  const exact = WEAPON_NAMES[dbName] ?? WEAPON_NAMES[dbName.replace(/\s*\(.*\)\s*$/, "").trim()];
  if (!exact) return fallback;
  return exact[lang] ?? fallback;
}

const GEAR_SET_NAMES = gearSetNamesJson as unknown as Record<string, AttrEntry>;

const GEAR_SET_NAME_TO_KEY: Record<string, string> = (() => {
  const db = gearDbJson as unknown as {
    green_set_info?: Record<string, { name?: string }>;
  };
  const out: Record<string, string> = {};
  for (const [key, info] of Object.entries(db.green_set_info ?? {})) {
    if (info?.name) out[info.name] = key;
  }
  return out;
})();

/**
 * Gearset-Name uebersetzen. Akzeptiert DB-Key ('striker') oder DB-Namen
 * ('Striker's Battlegear'); Zuordnung via gear.json green_set_info.
 */
export function tGearSetName(dbNameOrKey: string, lang: ItemLang, fallback: string): string {
  const key = GEAR_SET_NAMES[dbNameOrKey] ? dbNameOrKey : GEAR_SET_NAME_TO_KEY[dbNameOrKey];
  if (!key) return fallback;
  const entry = GEAR_SET_NAMES[key];
  return entry?.[lang] ?? fallback;
}

const ITEM_NAMES: Record<string, AttrEntry> = {};

export function tItemName(kind: "weapon" | "gear" | "talent", id: string, lang: ItemLang, fallback: string): string {
  const entry = ITEM_NAMES[`${kind}:${id.toLowerCase()}`];
  if (!entry) return fallback;
  return entry[lang] ?? fallback;
}
