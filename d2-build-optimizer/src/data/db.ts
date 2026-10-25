import type { GearSlot } from "./sampleData";
import weaponsJson from "../db/weapons.json";
import gearJson from "../db/gear.json";
import modsJson from "../db/mod.json";
import talentsJson from "../db/talent.json";
import talentsDisplayJson from "../db/talents-display.json";

export type WeaponTypeKey = "ar" | "smg" | "lmg" | "rifle" | "mmr" | "shotgun" | "pistol";

export interface TalentEntry {
  key: string;
  name: string;
  label: string;
  weaponTypes: WeaponTypeKey[];
  group: string;
  description: string;
}

export interface DisplayTalent {
  name: string;
  description: string;
  group: string;
}

export const TALENT_DISPLAY_TYPE_MAP: Record<WeaponTypeKey, string> = {
  ar: "Sturmgewehre",
  smg: "Maschinenpistolen",
  lmg: "Leichte Maschinengewehre",
  rifle: "Gewehre",
  mmr: "Pr\u00e4zisionsgewehre",
  shotgun: "Schrotflinten",
  pistol: "Pistolen",
};

export const NAMED_TALENT_CARRIERS: Record<string, string> = {
  "Perfekter Optimist": "Shield Splinterer & Diceros Special",
  "Perfekt strapaziert": "Dark Winter & Cold Relations",
  "Perfekt synchronisiert": "Test Subject & Harmony",
  "Perfekter Killer": "The Apartment & Caretaker",
  "Perfekte Flachlage": "Kingbreaker & Dare",
  "Perfekter Sadist": "Carnage & Survivalist D50",
  "Perfekt entz\u00fcndet": "Pyromaniac",
  "Perfekt blind": "The Darkness",
  "Perfekter Druckpunkt": "Goalie & Rusty",
  "Perfekt entschlossen": "Prophet & Relic",
  "Perfekter Sch\u00fctze": "The Archivist & Ekim's Long Stick",
  "Perfektes Erstblut": "Pinprick",
  "Perfekt von hinten": "Whisper & Brutus",
  "Perfekte flinke H\u00e4nde": "Good Times",
  "Perfekte Bewahrung": "Emeline's Guard & P320 XCompact",
  "Perfekt stabil": "Tabula Rasa",
};

export function talentsAllowedForWeapon(
  weaponName: string,
  isNamed: boolean,
): (t: string) => boolean {
  const carriers = Object.entries(NAMED_TALENT_CARRIERS)
    .filter(([, c]) => c.split("&").map((x) => x.trim()).includes(weaponName))
    .map(([t]) => t);
  return (talentName: string) => {
    if (!talentName.startsWith("Perfekt")) return true;
    return isNamed && carriers.includes(talentName);
  };
}

export function carrierForTalent(talentName: string): string | null {
  return NAMED_TALENT_CARRIERS[talentName] ?? null;
}

export const TALENT_TYPE_MAP: Record<string, WeaponTypeKey> = {
  AR: "ar",
  MP: "smg",
  LMG: "lmg",
  Rifle: "rifle",
  MMR: "mmr",
  Shotgun: "shotgun",
  Pistol: "pistol",
};

export interface DbWeaponStats {
  "RPM"?: number;
  "Base Mag Size"?: number;
  "Modded Mag Size"?: number;
  "Level 40 Damage"?: number;
  "DPS (rps*dmg)"?: number;
  "Sustain DPS (dmg/time)"?: number;
  "Mod Slots"?: string;
  "HSD"?: number;
  [k: string]: unknown;
}

export interface DbWeapon {
  name: string;
  type: string;
  rarity: string;
  is_exotic: boolean;
  is_named: boolean;
  replica?: boolean;
  note?: string;
  stats: DbWeaponStats;
  named?: { talent?: { name?: string; label?: string } | null; attribute?: { text?: string } | null } | null;
  exotic?: { talent?: { name?: string } | null } | null;
}

export interface DbGearEntry {
  slot: string;
  brand: string;
  cls: "named" | "exotic";
  proto?: boolean;
  core: string;
  fixed: (string | number)[][];
  free: number;
  mods: number;
  perk?: string;
}

export interface DbBrandInfo {
  name: string;
  group?: string;
  weapon_hint?: string;
  bonuses_pve?: Record<string, Record<string, unknown>>;
  [k: string]: unknown;
}

export interface DbGreenSetInfo {
  name: string;
  group?: string;
  n2?: string;
  n3?: string;
  n4?: string;
  modeled?: string;
  [k: string]: unknown;
}

export interface DbSlotMod {
  name: string;
  slotTypes: string[];
  bonus: { type: string; val: number } | null;
  penalty: { type: string; val: number } | null;
}

export const SLOT_DE_LABELS: Record<string, GearSlot> = {
  Maske: "mask",
  Weste: "chest",
  Holster: "holster",
  Rucksack: "backpack",
  Handschuhe: "gloves",
  Knieschoner: "kneepads",
};

const WEAPON_TYPE_MAP: { match: string; key: WeaponTypeKey }[] = [
  { match: "Sturmgewehr", key: "ar" },
  { match: "Maschinenpistole", key: "smg" },
  { match: "Leichtes Maschinengewehr", key: "lmg" },
  { match: "Gewehr", key: "rifle" },
  { match: "Scharfschütze", key: "mmr" },
  { match: "Schrotflinte", key: "shotgun" },
  { match: "Pistole", key: "pistol" },
];

export function weaponTypeKey(typeLabel: string): WeaponTypeKey {
  for (const m of WEAPON_TYPE_MAP) {
    if (typeLabel.startsWith(m.match)) return m.key;
  }
  return "ar";
}

interface WeaponsFile {
  weapons: DbWeapon[];
  _meta?: { version?: string };
}

interface GearFile {
  version: string;
  gear_db: Record<string, DbGearEntry>;
  brand_set_info: Record<string, DbBrandInfo>;
  green_set_info: Record<string, DbGreenSetInfo>;
}

interface TalentsFile {
  version: string;
  talents: { key: string; name: string; label: string; weapon_types: string[]; group: string; description: string }[];
}

interface ModsFile {
  version: string;
  slots: Record<string, DbSlotMod[]>;
  exotic_mods: Record<string, Record<string, { name: string; bonus: { type: string; val: number } | null }>>;
}

export interface WeaponPreset {
  name: string;
  typeKey: WeaponTypeKey;
  isExotic: boolean;
  isNamed: boolean;
  baseDamage: number;
  rpm: number;
  magSize: number;
  modSlotCount: number;
  talent: string | null;
  note: string;
}

export interface GearTalentEntry {
  key: string;
  slot: "chest" | "backpack";
  label: string;
  note: string;
}

export const GEAR_TALENTS: GearTalentEntry[] = [
  { key: "obliterate", slot: "chest", label: "Vernichten", note: "Kritische Treffer: +1 % Waffenschaden für 10s, bis zu 20 Stacks." },
  { key: "glasscannon", slot: "chest", label: "Glaskanone", note: "+25 % verstärkter Schaden – ABER du erleidest 50 % mehr Schaden." },
  { key: "intimidate", slot: "chest", label: "Einschüchtern", note: "Mit Bonus-Rüstung: +4 % Schaden gegen Ziele in 10m pro Stack (max. 9)." },
  { key: "spotter", slot: "chest", label: "Späher", note: "+15 % verstärkter Schaden gegen gepulste Gegner." },
  { key: "focus", slot: "chest", label: "Fokus", note: "+5 % Waffenschaden pro Sekunde beim Zielen mit 8x+ Scope, bis max. +50 %." },
  { key: "spark", slot: "chest", label: "Funke", note: "Skill-Treffer: +15 % Waffenschaden für 15s." },
  { key: "gunslinger", slot: "chest", label: "Gunslinger", note: "Waffenwechsel: +23 % Waffenschaden für 5s." },
  { key: "headhunter", slot: "chest", label: "Kopfgeldjäger", note: "Nach Kopfschuss-Kill: nächster Treffer +125 % des Todesstoß-Schadens." },
  { key: "unbreakable", slot: "chest", label: "Unzerstörbar", note: "Repariert 95 % Rüstung bei Rüstungsverlust (60s CD)." },
  { key: "vigilance", slot: "backpack", label: "Wachsamkeit", note: "+25 % Waffenschaden, deaktiviert 4s nach erlittenem Schaden." },
  { key: "composure", slot: "backpack", label: "Gelassenheit", note: "+15 % Waffenschaden in Deckung." },
  { key: "companion", slot: "backpack", label: "Gefährte", note: "+15 % Waffenschaden, wenn Verbündeter/Fähigkeit in 5m Nähe." },
  { key: "concussion", slot: "backpack", label: "Gehirnerschütterung", note: "Kopftreffer +10 %, Kopfschuss-Kill +15 % Waffenschaden." },
  { key: "wicked", slot: "backpack", label: "Böse", note: "Status-Effekt anwenden: +18 % Waffenschaden für 20s." },
  { key: "unstoppable", slot: "backpack", label: "Unaufhaltsame Kraft", note: "Kill: +5 % Waffenschaden für 15s, bis 5 Stacks." },
  { key: "versatile", slot: "backpack", label: "Vielseitig", note: "Waffengattungsabhängig +10–35 % Schaden nach Waffenwechsel." },
  { key: "clutch", slot: "backpack", label: "Kupplung", note: "Kritische Treffer reparieren Rüstung unter 15 % Rüstung." },
  { key: "bloodsucker", slot: "backpack", label: "Blutsauger", note: "Kill: +10 % Bonus-Rüstung pro Stack (10 Stacks)." },
];

export interface GearPreset {
  name: string;
  slot: GearSlot;
  brand: string;
  cls: "named" | "exotic";
  core: string;
  fixedAttrs: { type: string; value: number }[];
  perk: string;
  proto: boolean;
}

export interface BrandItemPreset {
  brand: string;
  slots: GearSlot[];
}

export interface Db {
  weapons: WeaponPreset[];
  talents: TalentEntry[];
  brandItems: BrandItemPreset[];
  displayTalents: DisplayTalent[];
  talentDisplayByType: Record<string, DisplayTalent[]>;
  gear: GearPreset[];
  brandSets: { key: string; name: string; bonuses: { pieces: number; bonus: string }[] }[];
  gearSets: { key: string; name: string; bonuses: { pieces: number; bonus: string }[] }[];
  mods: { name: string; slot: string; slotTypes: string[]; bonus: string; penalty: string | null }[];
  versions: { weapons: string; gear: string; mods: string; talents: string };
}

const CORE_LABELS: Record<string, string> = {
  wd: "Waffenschaden",
  armour: "Panzerung",
  skill: "Skill-Hastung",
  any: "frei wählbar",
};

export function coreLabel(core: string): string {
  return CORE_LABELS[core] ?? core;
}

let dbPromise: Promise<Db> | null = null;

function load(): Db {
  const weaponsFile = weaponsJson as unknown as WeaponsFile;
  const gearFile = gearJson as unknown as GearFile;
  const modsFile = modsJson as unknown as ModsFile;
  const talentsFile = talentsJson as unknown as TalentsFile;

  const weapons: WeaponPreset[] = weaponsFile.weapons
    .filter((w) => w.stats && typeof w.stats["Level 40 Damage"] === "number")
    .map((w) => {
      const talent =
        w.exotic?.talent?.name ??
        w.named?.talent?.label ??
        w.named?.talent?.name ??
        null;
      const rawSlots = String(w.stats["Mod Slots"] ?? "0");
      const modSlotCount = Math.min(4, Math.max(0, parseInt(rawSlots, 10) || 0));
      return {
        name: w.name,
        typeKey: weaponTypeKey(w.type),
        isExotic: w.is_exotic,
        isNamed: w.is_named,
        baseDamage: w.stats["Level 40 Damage"] ?? 0,
        rpm: w.stats["RPM"] ?? 0,
        magSize: w.stats["Modded Mag Size"] ?? w.stats["Base Mag Size"] ?? 0,
        modSlotCount,
        talent,
        note: w.note ?? "",
      };
    });

  const gear: GearPreset[] = Object.entries(gearFile.gear_db).map(([name, g]) => ({
    name,
    slot: SLOT_DE_LABELS[g.slot] ?? "mask",
    brand: g.brand || (g.cls === "exotic" ? "Exotic" : "Named"),
    cls: g.cls,
    core: coreLabel(g.core),
    fixedAttrs: (g.fixed ?? []).map(([k, v]) => ({ type: String(k), value: Number(v) })),
    perk: g.perk ?? "",
    proto: g.proto ?? false,
  }));

  const brandSets = Object.entries(gearFile.brand_set_info).map(([key, b]) => ({
    key,
    name: b.name,
    bonuses: [b.weapon_hint ?? null, b["1p"] as string | undefined, b["2p"] as string | undefined, b["3p"] as string | undefined]
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .map((text, i) => ({ pieces: i + 1, bonus: text })),
  }));

  const gearSets = Object.entries(gearFile.green_set_info).map(([key, s]) => ({
    key,
    name: s.name,
    bonuses: [s.n2, s.n3, s.n4]
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .map((text, i) => ({ pieces: i + 2, bonus: text })),
  }));

  const mods = Object.entries(modsFile.slots).flatMap(([slot, list]) =>
    list.map((m) => ({
      name: m.name,
      slot,
      slotTypes: m.slotTypes,
      bonus: m.bonus ? `${m.bonus.type} +${m.bonus.val}` : "\u2013",
      penalty: m.penalty ? `${m.penalty.type} -${Math.abs(m.penalty.val)}` : null,
    })),
  );

  const displayFile = talentsDisplayJson as unknown as Record<string, DisplayTalent[]>;
  const displayTalents: DisplayTalent[] = [
    ...(displayFile["Allgemeine Waffen"] ?? []),
  ];

  const talents: TalentEntry[] = (talentsFile.talents ?? []).map((tal) => ({
    key: tal.key,
    name: tal.name,
    label: tal.label,
    weaponTypes: (tal.weapon_types ?? []).map((w) => TALENT_TYPE_MAP[w]).filter((w): w is WeaponTypeKey => Boolean(w)),
    group: tal.group,
    description: tal.description,
  }));

  const brandItems: BrandItemPreset[] = Object.values(gearFile.brand_set_info).map((b) => ({
    brand: b.name,
    slots: ["mask", "chest", "holster", "backpack", "gloves", "kneepads"],
  }));

  return {
    weapons,
    talents,
    brandItems,
    displayTalents,
    talentDisplayByType: Object.fromEntries(
      Object.entries(displayFile).filter(([k]) => k !== "Allgemeine Waffen"),
    ) as Record<string, DisplayTalent[]>,
    gear,
    brandSets,
    gearSets,
    mods,
    versions: {
      weapons: weaponsFile._meta?.version ?? "unbekannt",
      gear: gearFile.version,
      mods: modsFile.version,
      talents: talentsFile.version,
    },
  };
}

export function getDb(): Promise<Db> {
  if (!dbPromise) dbPromise = Promise.resolve(load());
  return dbPromise;
}
