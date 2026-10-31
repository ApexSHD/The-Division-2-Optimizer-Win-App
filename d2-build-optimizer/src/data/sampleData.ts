export type WeaponType = "ar" | "smg" | "lmg" | "rifle" | "mmr" | "shotgun" | "pistol";

export const RELOAD_SECONDS_BY_TYPE: Record<WeaponType, number> = {
  ar: 2.4,
  smg: 2.2,
  lmg: 4.1,
  rifle: 2.7,
  mmr: 3.0,
  shotgun: 3.6,
  pistol: 1.9,
};

export function reloadSecondsFor(weapon: Partial<Weapon> & Pick<Weapon, "type">): number {
  if (weapon.reloadSeconds !== undefined && weapon.reloadSeconds > 0) {
    return weapon.reloadSeconds;
  }
  return RELOAD_SECONDS_BY_TYPE[weapon.type];
}
export type Rarity = "exotic" | "named" | "highend";
export type WeaponAttrKey =
  | "dth" | "chc" | "chd" | "dttooc" | "hsd" | "dta" | "rof"
  | "magSize" | "handling" | "range" | "reloadSpeed" | "armorOnKill";

export interface WeaponAttributes {
  core1: number;
  core2Type: WeaponAttrKey;
  core2Val: number;
  minorType: WeaponAttrKey;
  minorVal: number;
}

export interface WeaponMod {
  slot: "optic" | "muzzle" | "underbarrel" | "magazine";
  attr: WeaponAttrKey | "capacity";
  value: number;
  dbName?: string;
  reloadPenalty?: number;
}

export interface Weapon {
  id: string;
  name: string;
  type: WeaponType;
  rarity: Rarity;
  baseDamage: number;
  rpm: number;
  magSize: number;
  talent: string;
  modSlots: ("optic" | "muzzle" | "underbarrel" | "magazine")[];
  note?: string;
  knowHow: number;
  isPrototype: boolean;
  attributes: WeaponAttributes;
  innateHsd?: number;
  reloadSeconds?: number;
  equippedMods?: WeaponMod[];
}

export const WEAPON_ATTR_LABELS: Record<WeaponAttrKey, string> = {
  dth: "Lebenspunktschaden (DTH)",
  chc: "Kritische Trefferchance (CHC)",
  chd: "Kritischer Trefferschaden (CHD)",
  dttooc: "Schaden gg. ungedeckte Ziele (DTToOC)",
  hsd: "Kopfschussschaden (HSD)",
  dta: "Rüstungsschaden (DTA)",
  rof: "Feuerrate (RoF)",
  magSize: "Magazingröße",
  handling: "Waffenhandling",
  range: "Optimale Reichweite",
  reloadSpeed: "Nachladetempo",
  armorOnKill: "Gegner bei Tötung reparieren (AoK)",
};

export const WEAPON_MINOR_MAX: Record<WeaponAttrKey, number> = {
  dttooc: 10, dta: 6, dth: 10, chc: 9.5, chd: 10, hsd: 10,
  magSize: 12.5, handling: 14, range: 24, rof: 5, reloadSpeed: 15, armorOnKill: 10,
};

export const WEAPON_CORE1_MAX = 15;

export const WEAPON_CORE2_BY_TYPE: Record<WeaponType, { type: WeaponAttrKey; max: number } | null> = {
  ar: { type: "dth", max: 21 },
  smg: { type: "chc", max: 21 },
  lmg: { type: "dttooc", max: 12 },
  rifle: { type: "chd", max: 34 },
  mmr: { type: "hsd", max: 111 },
  shotgun: { type: "dta", max: 12 },
  pistol: null,
};

export function weaponAttrMax(baseMax: number, isPrototype: boolean): number {
  return isPrototype ? baseMax * 1.5 : baseMax;
}

export function godRollAttributes(type: WeaponType, isPrototype: boolean): WeaponAttributes {
  const core2 = WEAPON_CORE2_BY_TYPE[type];
  return {
    core1: weaponAttrMax(WEAPON_CORE1_MAX, isPrototype),
    core2Type: core2?.type ?? "dth",
    core2Val: core2 ? weaponAttrMax(core2.max, isPrototype) : weaponAttrMax(WEAPON_MINOR_MAX.dttooc, isPrototype),
    minorType: "dttooc",
    minorVal: weaponAttrMax(WEAPON_MINOR_MAX.dttooc, isPrototype),
  };
}

export function normalizeWeapon(
  w: Partial<Weapon> & Pick<Weapon, "id" | "name" | "type">,
): Weapon {
  const type = w.type;
  const attrs = (w.attributes ?? {}) as Partial<WeaponAttributes>;
  const isPrototype = w.isPrototype ?? false;
  const god = godRollAttributes(type, isPrototype);
  return {
    id: w.id,
    name: w.name,
    type,
    rarity: w.rarity ?? "highend",
    baseDamage: w.baseDamage ?? 0,
    rpm: w.rpm ?? 0,
    magSize: w.magSize ?? 0,
    talent: w.talent ?? "",
    modSlots: w.modSlots ?? ["optic", "muzzle", "underbarrel", "magazine"],
    note: w.note,
    knowHow: isPrototype ? 30 : w.knowHow ?? 30,
    isPrototype,
    reloadSeconds: w.reloadSeconds,
    equippedMods: w.equippedMods,
    innateHsd: w.innateHsd,
    attributes: {
      core1: attrs.core1 ?? god.core1,
      core2Type: attrs.core2Type ?? god.core2Type,
      core2Val: attrs.core2Val ?? god.core2Val,
      minorType: attrs.minorType ?? god.minorType,
      minorVal: attrs.minorVal ?? god.minorVal,
    },
  };
}

export type GearSlot = "mask" | "chest" | "holster" | "backpack" | "gloves" | "kneepads";
export type GearCoreType = "wd" | "armour" | "skill";
export type GearAttrKey =
  | "chc" | "chd" | "hsd" | "wh" | "armorregen" | "explres" | "hazard" | "health"
  | "skilldmg" | "skillhaste" | "repair" | "status"
  | "wd" | "dta" | "dttooc" | "dth" | "rof" | "aok" | "incomrepair";

export interface GearAttr {
  type: GearAttrKey;
  value: number;
}

export interface GearPiece {
  id: string;
  slot: GearSlot;
  brand: string;
  brandType: "brand" | "gearset" | "named" | "exotic";
  core: GearCoreType;
  coreValue: number;
  attributes: GearAttr[];
  talent: string | null;
  prototype: boolean;
  mod?: { attr: GearAttrKey; value: number } | null;
}

export const GEAR_CORE_LABELS: Record<GearCoreType, string> = {
  wd: "Waffenschaden",
  armour: "Rüstung",
  skill: "Skill-Tier",
};

export const GEAR_ATTR_TYPES: Record<GearAttrKey, { label: string; group: string; max: number | null }> = {
  chc: { label: "Kritische Trefferchance", group: "Offensiv (Rot)", max: 6 },
  chd: { label: "Kritischer Trefferschaden", group: "Offensiv (Rot)", max: 12 },
  hsd: { label: "Kopfschussschaden", group: "Offensiv (Rot)", max: 10 },
  wh: { label: "Waffenhandhabung", group: "Offensiv (Rot)", max: 8 },
  armorregen: { label: "Rüstungsregeneration", group: "Defensiv (Blau)", max: 4925 },
  explres: { label: "Explosionswiderstand", group: "Defensiv (Blau)", max: 10 },
  hazard: { label: "Gefahrenschutz", group: "Defensiv (Blau)", max: 10 },
  health: { label: "Lebenspunkte", group: "Defensiv (Blau)", max: 18935 },
  skilldmg: { label: "Fertigkeitenschaden", group: "Hilfsmittel (Gelb)", max: 10 },
  skillhaste: { label: "Fertigkeiten-Tempo", group: "Hilfsmittel (Gelb)", max: 12 },
  repair: { label: "Reparatur-Fertigkeiten", group: "Hilfsmittel (Gelb)", max: 20 },
  status: { label: "Statuseffekte", group: "Hilfsmittel (Gelb)", max: 10 },
  wd: { label: "Waffenschaden (Minor)", group: "Offensiv (Rot)", max: 15 },
  dta: { label: "Rüstungsschaden", group: "Offensiv (Rot)", max: 8 },
  dttooc: { label: "Schaden gg. ungedeckte Ziele", group: "Offensiv (Rot)", max: 8 },
  dth: { label: "Lebenspunktschaden", group: "Offensiv (Rot)", max: 10 },
  rof: { label: "Feuerrate", group: "Offensiv (Rot)", max: 5 },
  aok: { label: "Rüstung bei Tötung", group: "Defensiv (Blau)", max: 10 },
  incomrepair: { label: "Erhaltene Reparatur", group: "Defensiv (Blau)", max: 20 },
};

export const GEAR_CORE_MAX: Record<GearCoreType, number> = {
  wd: 15,
  armour: 170000,
  skill: 1,
};

export function gearCoreMax(core: GearCoreType, isPrototype: boolean): number {
  if (core === "skill") return isPrototype ? 1.5 : 1;
  return isPrototype ? GEAR_CORE_MAX[core] * 1.5 : GEAR_CORE_MAX[core];
}

export function gearCoreDisplay(core: GearCoreType, value: number): string {
  return core === "skill" ? `Skill-Tier ${value.toLocaleString("de-DE")}` : `${value.toLocaleString("de-DE")}`;
}

export const GEAR_REGULAR_ATTR_KEYS: GearAttrKey[] = [
  "chc", "chd", "hsd", "wh",
  "armorregen", "health", "explres", "hazard",
  "skillhaste", "repair", "skilldmg", "status",
];

export function gearAttrMax(key: GearAttrKey, isPrototype: boolean): number | null {
  const cfg = GEAR_ATTR_TYPES[key];
  if (!cfg || cfg.max == null) return null;
  return isPrototype ? cfg.max * 1.5 : cfg.max;
}

export function normalizeGear(g: Partial<GearPiece> & Pick<GearPiece, "id" | "slot" | "brand">): GearPiece {
  const brandType = g.brandType ?? "brand";
  const isExotic = brandType === "exotic";
  const prototype = isExotic ? false : g.prototype ?? true;
  const attributes = Array.isArray(g.attributes)
    ? g.attributes
        .map((a) => {
          if (typeof a === "string") return null;
          return a as GearAttr;
        })
        .filter((a): a is GearAttr => a !== null && Boolean(GEAR_ATTR_TYPES[a.type]))
    : [];
  return {
    id: g.id,
    slot: g.slot,
    brand: g.brand,
    brandType,
    core: g.core ?? "wd",
    coreValue: g.coreValue ?? gearCoreMax(g.core ?? "wd", prototype),
    attributes,
    talent: g.talent ?? null,
    prototype,
    mod: g.mod && GEAR_ATTR_TYPES[g.mod.attr] ? g.mod : null,
  };
}

export interface Mod {
  id: string;
  category: "optic" | "muzzle" | "underbarrel" | "magazine";
  compat: string[];
  value: string;
}

export interface BrandSet {
  id: string;
  name: string;
  bonuses: { pieces: number; bonus: string }[];
}

export interface Build {
  id: string;
  name: string;
  weaponIds: string[];
  gearIds: Partial<Record<GearSlot, string>>;
  note: string;
  timestamp: string;
}

export interface LoadoutMetrics {
  dps: number;
  chc: number;
  chd: number;
  wd: number;
  hsd: number;
  armor: number;
}

export interface Loadout extends Build {
  roleId: string;
  assumptions: string[];
  metrics: LoadoutMetrics;
  dbVersion: string;
  signatures?: Record<string, string>;
}

export const DB_VERSION = "weapons_v1 · gear_v1 · mods_v1";

export const sampleWeapons: Weapon[] = [
  { id: "w1", name: "Eagle Bearer", type: "ar", rarity: "exotic", baseDamage: 32480, rpm: 760, magSize: 30, talent: "Eagle Bearer (Exotic)", modSlots: ["optic", "muzzle", "underbarrel", "magazine"], note: "Chest+Backpack-Bonus aktiv" , knowHow: 30, isPrototype: false, attributes: godRollAttributes("ar", false) },
  { id: "w2", name: "Famas 2010 (Perfectly Vindictive)", type: "ar", rarity: "named", baseDamage: 27960, rpm: 900, magSize: 30, talent: "Perfectly Vindictive", modSlots: ["optic", "muzzle", "underbarrel", "magazine"] , knowHow: 30, isPrototype: false, attributes: godRollAttributes("ar", false) },
  { id: "w3", name: "Police M4", type: "ar", rarity: "highend", baseDamage: 26100, rpm: 760, magSize: 30, talent: "Strained", modSlots: ["optic", "muzzle", "underbarrel", "magazine"] , knowHow: 30, isPrototype: false, attributes: godRollAttributes("ar", false) },
  { id: "w4", name: "Dark Winter", type: "smg", rarity: "exotic", baseDamage: 24380, rpm: 725, magSize: 32, talent: "Vindictive (Exotic)", modSlots: ["optic", "muzzle", "magazine"] , knowHow: 30, isPrototype: false, attributes: godRollAttributes("smg", false) },
  { id: "w5", name: "Chatterbox", type: "smg", rarity: "exotic", baseDamage: 19420, rpm: 800, magSize: 32, talent: "Chatterbox (In sync)", modSlots: ["optic", "muzzle", "magazine"], note: "Magazin-Nachladung bei Kill" , knowHow: 30, isPrototype: false, attributes: godRollAttributes("smg", false) },
  { id: "w6", name: "St Elmo's Engine", type: "ar", rarity: "exotic", baseDamage: 29150, rpm: 760, magSize: 60, talent: "Feedback Loop (Exotic)", modSlots: ["optic", "muzzle", "underbarrel", "magazine"] , knowHow: 30, isPrototype: false, attributes: godRollAttributes("ar", false) },
  { id: "w7", name: "Classic M1A", type: "rifle", rarity: "highend", baseDamage: 68440, rpm: 260, magSize: 20, talent: "Boomerang", modSlots: ["optic", "muzzle", "underbarrel", "magazine"] , knowHow: 30, isPrototype: false, attributes: godRollAttributes("rifle", false) },
  { id: "w8", name: "The White Death", type: "mmr", rarity: "named", baseDamage: 98720, rpm: 55, magSize: 5, talent: "Headhunter (Perfect)", modSlots: ["optic", "muzzle", "underbarrel", "magazine"] , knowHow: 30, isPrototype: false, attributes: godRollAttributes("mmr", false) },
  { id: "w9", name: "Nemesis", type: "mmr", rarity: "exotic", baseDamage: 88560, rpm: 55, magSize: 5, talent: "Nemesis (Exotic)", modSlots: ["optic", "muzzle", "underbarrel", "magazine"] , knowHow: 30, isPrototype: false, attributes: godRollAttributes("mmr", false) },
  { id: "w10", name: "Sasg-12", type: "shotgun", rarity: "highend", baseDamage: 8820, rpm: 260, magSize: 8, talent: "Percussive Maintenance", modSlots: ["optic", "muzzle", "magazine"] , knowHow: 30, isPrototype: false, attributes: godRollAttributes("shotgun", false) },
  { id: "w11", name: "Bullet King", type: "lmg", rarity: "named", baseDamage: 24950, rpm: 550, magSize: 100, talent: "Bullet King (Perfect)", modSlots: ["optic", "muzzle", "underbarrel", "magazine"], note: "Kein Nachladen nötig" , knowHow: 30, isPrototype: false, attributes: godRollAttributes("lmg", false) },
  { id: "w12", name: "M870", type: "shotgun", rarity: "highend", baseDamage: 11270, rpm: 70, magSize: 5, talent: "Intimidate", modSlots: ["optic", "muzzle", "underbarrel"] , knowHow: 30, isPrototype: false, attributes: godRollAttributes("shotgun", false) },
  { id: "w13", name: "P416 Gutter", type: "ar", rarity: "highend", baseDamage: 25540, rpm: 800, magSize: 30, talent: "Fast Hands", modSlots: ["optic", "muzzle", "underbarrel", "magazine"] , knowHow: 30, isPrototype: false, attributes: godRollAttributes("ar", false) },
  { id: "w14", name: "Lady Death", type: "smg", rarity: "exotic", baseDamage: 19880, rpm: 900, magSize: 20, talent: "Vital Point Targeting", modSlots: ["optic", "muzzle", "underbarrel", "magazine"] , knowHow: 30, isPrototype: false, attributes: godRollAttributes("smg", false) },
  { id: "w15", name: "M700 Carbon", type: "mmr", rarity: "highend", baseDamage: 74300, rpm: 45, magSize: 5, talent: "Boomerang", modSlots: ["optic", "muzzle", "underbarrel", "magazine"] , knowHow: 30, isPrototype: false, attributes: godRollAttributes("mmr", false) },
  { id: "w16", name: "Tactical AUG A3", type: "smg", rarity: "highend", baseDamage: 17890, rpm: 750, magSize: 32, talent: "Preservation", modSlots: ["optic", "muzzle", "underbarrel", "magazine"] , knowHow: 30, isPrototype: false, attributes: godRollAttributes("smg", false) },
];

export const sampleGear: GearPiece[] = [];


export const sampleMods: Mod[] = [
  { id: "m1", category: "optic", compat: ["ar", "smg", "lmg"], value: "CHC +5 %" },
  { id: "m2", category: "optic", compat: ["rifle", "mmr"], value: "Kopfschaden +30 %" },
  { id: "m3", category: "muzzle", compat: ["ar", "smg", "lmg", "rifle"], value: "CHC +5 %" },
  { id: "m4", category: "muzzle", compat: ["ar", "smg", "lmg"], value: "WD +5 %" },
  { id: "m5", category: "underbarrel", compat: ["ar", "smg", "lmg", "rifle", "mmr"], value: "CHD +10 %" },
  { id: "m6", category: "underbarrel", compat: ["ar", "lmg"], value: "Stabilität +15 %" },
  { id: "m7", category: "magazine", compat: ["ar", "smg", "lmg", "rifle"], value: "Magazin +30" },
  { id: "m8", category: "magazine", compat: ["ar", "smg", "lmg"], value: "Rate of Fire +10 %" },
];

export const sampleBrandSets: BrandSet[] = [
  { id: "b1", name: "Walker, Harris & Co.", bonuses: [{ pieces: 2, bonus: "Panzerung +15 %" }, { pieces: 3, bonus: "Waffenschaden +10 %" }] },
  { id: "b2", name: "Overlord Armaments", bonuses: [{ pieces: 2, bonus: "RPM +5 %" }, { pieces: 3, bonus: "Waffen-Bonus +30 %" }] },
  { id: "b3", name: "Petrov Defense Group", bonuses: [{ pieces: 2, bonus: "LMG-Schaden +10 %" }, { pieces: 3, bonus: "Waffenschaden +10 %" }] },
  { id: "b4", name: "Grupo Sombra S.A.", bonuses: [{ pieces: 2, bonus: "Kritischer Trefferschaden +15 %" }, { pieces: 3, bonus: "Kritische Trefferchance +10 %" }] },
  { id: "b5", name: "Umbra Initiative", bonuses: [{ pieces: 2, bonus: "CHC +10 %" }, { pieces: 3, bonus: "CHD +15 %" }] },
  { id: "b6", name: "Ryang & Sachs", bonuses: [{ pieces: 2, bonus: "CHD +15 %" }, { pieces: 3, bonus: "CHC +10 %" }] },
];

export const sampleGearSets: BrandSet[] = [
  { id: "gs1", name: "Tip of the Spear", bonuses: [{ pieces: 2, bonus: "Spezialisierungs-Schaden +20 %" }, { pieces: 3, bonus: "Spezialisierungs-Munition +5" }, { pieces: 4, bonus: "Signaturwaffen-Schaden +100 %" }] },
  { id: "gs2", name: "Hard Hitting", bonuses: [{ pieces: 2, bonus: "CHD +15 %" }, { pieces: 3, bonus: "CHC +10 %" }, { pieces: 4, bonus: "Krit-Bonus +25 %" }] },
  { id: "gs3", name: "Foundry Bulwark", bonuses: [{ pieces: 2, bonus: "Panzerungs-Regeneration +100 %" }, { pieces: 3, bonus: "Panzerung +20 %" }, { pieces: 4, bonus: "Panzerungs-Bonus +30 %" }] },
  { id: "gs4", name: "Future Initiative", bonuses: [{ pieces: 2, bonus: "Reparatur-Skills +30 %" }, { pieces: 3, bonus: "Panzerung +15 %" }, { pieces: 4, bonus: "Team-Panzerung +20 %" }] },
  { id: "gs5", name: "Eclipse Protocol", bonuses: [{ pieces: 2, bonus: "Status-Effekte +20 %" }, { pieces: 3, bonus: "Skill-Haste +15 %" }, { pieces: 4, bonus: "Status-Verbreitung" }] },
];

export const sampleBuilds: Build[] = [
  {
    id: "l1",
    name: "Crit-AR PvP",
    weaponIds: ["w1", "w16"],
    gearIds: { mask: "g1", chest: "g4", holster: "g9", backpack: "g10", gloves: "g14", kneepads: "g16" },
    note: "Standard-Crit-Build für PvP",
    timestamp: "2026-10-01T14:00:00Z",
  },
  {
    id: "l2",
    name: "Headhunter DMR",
    weaponIds: ["w8", "w15"],
    gearIds: { mask: "g2", chest: "g6", holster: "g8", backpack: "g12", gloves: "g13", kneepads: "g17" },
    note: "One-Shot-Setup mit Headhunter",
    timestamp: "2026-10-05T09:30:00Z",
  },
];
