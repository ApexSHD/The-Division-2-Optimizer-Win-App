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
  mmr: "Präzisionsgewehre",
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
  "Perfekt entzündet": "Pyromaniac",
  "Perfekt blind": "The Darkness",
  "Perfekter Druckpunkt": "Goalie & Rusty",
  "Perfekt entschlossen": "Prophet & Relic",
  "Perfekter Schütze": "The Archivist & Ekim's Long Stick",
  "Perfektes Erstblut": "Pinprick",
  "Perfekt von hinten": "Whisper & Brutus",
  "Perfekte flinke Hände": "Good Times",
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
  bonuses?: Record<string, { attr: string; val: number }[]>;
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
  { key: "gunslinger", slot: "chest", label: "Gunslinger", note: "Waffenwechsel erhöht den Waffenschaden 5s lang um +23%." },
  { key: "focus", slot: "chest", label: "Fokus", note: "+5% Waffenschaden pro Sekunde beim Zielen mit 8x oder stärker, bis max. +50%." },
  { key: "spark", slot: "chest", label: "Funke", note: "Schaden an einem Gegner durch Fähigkeit: +15% Waffenschaden für 15s." },
  { key: "obliterate", slot: "chest", label: "Vernichten", note: "Kritische Treffer: +1% Waffenschaden für 10s, bis zu 20 Stacks." },
  { key: "intimidate", slot: "chest", label: "Einschüchtern", note: "Mit Bonus-Rüstung: 9 Stacks à +4% Schaden gegen Ziele in 10m (multiplikativ, ≈ +42%)." },
  { key: "glasscannon", slot: "chest", label: "Glaskanone", note: "+25% verstärkter Schaden – ABER du erleidest 50% mehr Schaden." },
  { key: "spotter", slot: "chest", label: "Späher", note: "+15% verstärkter Schaden gegen gepulste Gegner." },
  { key: "headhunter", slot: "chest", label: "Kopfgeldjäger", note: "Nach Kopfschuss-Kill: nächster Treffer +125% des Todesstoß-Schadens." },
  { key: "empathicresolve", slot: "chest", label: "Empathische Entschlossenheit", note: "Team-Bonus (Waffen-/Skill-Schaden für Verbündete) – fließt nicht in den eigenen DPS ein." },
  { key: "overwatch", slot: "chest", label: "Überwachung", note: "Team-Bonus – fließt nicht in den eigenen DPS ein." },
  { key: "unbreakable", slot: "chest", label: "Unzerstörbar", note: "Repariert 95% Rüstung bei Rüstungsverlust (60s CD)." },
  { key: "vanguard", slot: "chest", label: "Vorhut", note: "Schild 5s unverwundbar + 45% Rüstung als Bonus-Rüstung für Verbündete." },
  { key: "protectedreload", slot: "chest", label: "Geschütztes Nachladen", note: "+20% Bonus-Rüstung beim Nachladen." },
  { key: "entrench", slot: "chest", label: "Schanzen", note: "Kopftreffer aus Deckung reparieren 20% Rüstung." },
  { key: "efficient", slot: "chest", label: "Effizient", note: "50% Chance, Rüstungsset nicht zu verbrauchen." },
  { key: "madbomber", slot: "chest", label: "Wahnsinniger Bomber", note: "+50% Granatenradius, Granaten werden bei Kill erstattet." },
  { key: "braced", slot: "chest", label: "Abgestützt", note: "+45% Waffenhandhabung in Deckung." },
  { key: "skilled", slot: "chest", label: "Geübt", note: "25% Chance auf Cooldown-Reset bei Skill-Kill." },
  { key: "tagteam", slot: "chest", label: "Teamwork", note: "Waffenschaden am markierten Ziel reduziert aktive Cooldowns um 6s." },
  { key: "trauma", slot: "chest", label: "Trauma", note: "Kopftreffer blendet, Brusttreffer verursacht Blutung (30s CD)." },
  { key: "tamperproof", slot: "chest", label: "Manipulationssicher", note: "Gegner in 3m der Fähigkeiten werden geschockt." },
  { key: "reassigned", slot: "chest", label: "Neu zugewiesen", note: "Kill: 1 Spezialmunition für die Seitenwaffe (15s CD)." },
  { key: "vigilance", slot: "backpack", label: "Wachsamkeit", note: "+25% Waffenschaden, deaktiviert 4s nach erlittenem Schaden." },
  { key: "versatile", slot: "backpack", label: "Vielseitig", note: "SMG/Shotgun +35% (unter 15m), Rifle/MMR +35% (über 25m), AR/LMG +10% (15–25m)." },
  { key: "unstoppableforce", slot: "backpack", label: "Unaufhaltsame Kraft", note: "Kill: +5% Waffenschaden für 15s, bis 5 Stacks (Granaten-Kills zählen doppelt)." },
  { key: "companion", slot: "backpack", label: "Gefährte", note: "+15% Waffenschaden, wenn ein Verbündeter oder eine Fähigkeit in 5m Nähe ist." },
  { key: "composure", slot: "backpack", label: "Gelassenheit", note: "+15% Waffenschaden in Deckung." },
  { key: "concussion", slot: "backpack", label: "Gehirnerschütterung", note: "Kopftreffer +10% (1,5s/5s), Kopfschuss-Kill +15% (10s) – zusammen +25%." },
  { key: "wicked", slot: "backpack", label: "Böse", note: "Status-Effekt anwenden: +18% Waffenschaden für 20s." },
  { key: "opportunistic", slot: "backpack", label: "Opportunistisch", note: "Schrotflinten-/MMR-Treffer: Gegner erleiden 10% mehr Schaden aus allen Quellen (5s)." },
  { key: "clutch", slot: "backpack", label: "Kupplung", note: "Kritische Treffer reparieren Rüstung unter 15% Rüstung." },
  { key: "safeguard", slot: "backpack", label: "Sicherung", note: "+130% Skill-Reparatur bei voller Rüstung." },
  { key: "bloodsucker", slot: "backpack", label: "Blutsauger", note: "Kill: +10% Bonus-Rüstung pro Stack (10 Stacks)." },
  { key: "leadership", slot: "backpack", label: "Führung", note: "Deckungswechsel: Bonus-Rüstung für dich und Verbündete." },
  { key: "protector", slot: "backpack", label: "Beschützer", note: "Schild-Schaden gewährt Bonus-Rüstung." },
  { key: "adrenalinerush", slot: "backpack", label: "Adrenalinschub", note: "20% Bonus-Rüstung in 10m Nähe (3 Stacks)." },
  { key: "galvanize", slot: "backpack", label: "Galvanisieren", note: "Blind/Fesseln/Verwirren/Schock: 40% Rüstung als Bonus-Rüstung." },
  { key: "energize", slot: "backpack", label: "Energiezufuhr", note: "Rüstungsset: +1 Fertigkeiten-Stufe für 15s." },
  { key: "calculated", slot: "backpack", label: "Berechnend", note: "Kills aus Deckung: -10% Skill-Cooldowns." },
  { key: "overclock", slot: "backpack", label: "Übertaktung", note: "+25% Nachladetempo & Cooldown-Reduktion nahe Fähigkeiten." },
  { key: "creepingdeath", slot: "backpack", label: "Kriechender Tod", note: "Statuseffekte werden auf Gegner im Umkreis übertragen." },
];

export interface GearPreset {
  name: string;
  slot: GearSlot;
  brand: string;
  cls: "named" | "exotic";
  core: string;
  fixedAttrs: { type: string; value: number }[];
  namedSpecialAttr: { type: string; value: number } | null;
  perk: string;
  proto: boolean;
}

const NAMED_ATTR_PATTERNS: { key: string; pattern: RegExp }[] = [
  { key: "dth", pattern: /Lebenspunktschaden/ },
  { key: "dttooc", pattern: /ungedeckte Ziele/ },
  { key: "dta", pattern: /Rüstungsschaden/ },
  { key: "hsd", pattern: /Kopfschussschaden/ },
  { key: "chc", pattern: /Trefferchance/ },
  { key: "chd", pattern: /Trefferschaden/ },
  { key: "wd", pattern: /Waffenschaden/ },
  { key: "pulsehaste", pattern: /Scanner-Puls/ },
  { key: "range", pattern: /Reichweite/ },
  { key: "aok", pattern: /Tötung/ },
  { key: "wh", pattern: /Waffenhandhabung/ },
  { key: "skillhealth", pattern: /Fähigkeits-Gesundheit/ },
  { key: "status", pattern: /Statuseffekte/ },
  { key: "rof", pattern: /Feuerrate/ },
];

function parseNamedSpecialAttr(perk: string): { type: string; value: number } | null {
  const m = perk.match(/\+([\d.,]+)\s*%\s*(.+?)\s*\((?:[^)]*fix)/i);
  if (!m) return null;
  const value = Number(m[1].replace(",", "."));
  const label = m[2];
  for (const { key, pattern } of NAMED_ATTR_PATTERNS) {
    if (pattern.test(label)) return { type: key, value };
  }
  return null;
}

export interface BrandItemPreset {
  brand: string;
  slots: GearSlot[];
}

export interface GearSetItemPreset {
  key: string;
  name: string;
  slots: GearSlot[];
}

export interface Db {
  weapons: WeaponPreset[];
  talents: TalentEntry[];
  brandItems: BrandItemPreset[];
  gearSetItems: GearSetItemPreset[];
  displayTalents: DisplayTalent[];
  talentDisplayByType: Record<string, DisplayTalent[]>;
  gear: GearPreset[];
  brandSets: { key: string; name: string; bonuses: { pieces: number; bonus: string }[]; numericBonusesPve?: Record<string, Record<string, unknown>> }[];
  gearSets: { key: string; name: string; bonuses: { pieces: number; bonus: string }[]; numericBonuses?: Record<string, { attr: string; val: number }[]> }[];
  mods: { name: string; slot: string; slotTypes: string[]; bonus: string; penalty: string | null }[];
  modSlots: Record<string, { name: string; slotTypes: string[]; bonus: { type: string; val: number } | null; penalty: { type: string; val: number } | null }[]>;
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
    core: g.core,
    fixedAttrs: (g.fixed ?? []).map(([k, v]) => ({ type: String(k), value: Number(v) })),
    namedSpecialAttr: g.cls === "named" ? parseNamedSpecialAttr(g.perk ?? "") : null,
    perk: g.perk ?? "",
    proto: g.proto ?? false,
  }));

  const brandSets = Object.entries(gearFile.brand_set_info).map(([key, b]) => ({
    key,
    name: b.name,
    bonuses: [b.weapon_hint ?? null, b["1p"] as string | undefined, b["2p"] as string | undefined, b["3p"] as string | undefined]
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .map((text, i) => ({ pieces: i + 1, bonus: text })),
    numericBonusesPve: (b.bonuses_pve ?? {}) as Record<string, Record<string, unknown>>,
  }));

  const gearSets = Object.entries(gearFile.green_set_info).map(([key, s]) => ({
    key,
    name: s.name,
    bonuses: [s.n2, s.n3, s.n4]
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .map((text, i) => ({ pieces: i + 2, bonus: text })),
    numericBonuses: (s.bonuses ?? {}) as Record<string, { attr: string; val: number }[]>,
  }));

  const modSlots = Object.fromEntries(
    Object.entries(modsFile.slots).map(([slot, list]) => [
      slot,
      list.map((m) => ({ name: m.name, slotTypes: m.slotTypes, bonus: m.bonus, penalty: m.penalty })),
    ]),
  );

  const mods = Object.entries(modsFile.slots).flatMap(([slot, list]) =>
    list.map((m) => ({
      name: m.name,
      slot,
      slotTypes: m.slotTypes,
      bonus: m.bonus ? `${m.bonus.type} +${m.bonus.val}` : "–",
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

  const gearSetItems: GearSetItemPreset[] = Object.entries(gearFile.green_set_info).map(([key, gs]) => ({
    key,
    name: gs.name,
    slots: ["mask", "chest", "holster", "backpack", "gloves", "kneepads"],
  }));

  return {
    weapons,
    talents,
    brandItems,
    gearSetItems,
    displayTalents,
    talentDisplayByType: Object.fromEntries(
      Object.entries(displayFile).filter(([k]) => k !== "Allgemeine Waffen"),
    ) as Record<string, DisplayTalent[]>,
    gear,
    brandSets,
    gearSets,
    mods,
    modSlots,
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
