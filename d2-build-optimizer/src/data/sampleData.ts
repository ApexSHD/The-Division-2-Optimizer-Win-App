export type WeaponType = "ar" | "smg" | "lmg" | "rifle" | "mmr" | "shotgun" | "pistol";
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
}

export const WEAPON_ATTR_LABELS: Record<WeaponAttrKey, string> = {
  dth: "Lebenspunktschaden (DTH)",
  chc: "Kritische Trefferchance (CHC)",
  chd: "Kritischer Trefferschaden (CHD)",
  dttooc: "Schaden gg. ungedeckte Ziele (DTToOC)",
  hsd: "Kopfschussschaden (HSD)",
  dta: "R\u00fcstungsschaden (DTA)",
  rof: "Feuerrate (RoF)",
  magSize: "Magazingr\u00f6\u00dfe",
  handling: "Waffenhandling",
  range: "Optimale Reichweite",
  reloadSpeed: "Nachladetempo",
  armorOnKill: "Gegner bei T\u00f6tung reparieren (AoK)",
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

export interface GearPiece {
  id: string;
  slot: GearSlot;
  brand: string;
  brandType: "brand" | "gearset" | "named" | "exotic";
  core: string;
  attributes: string[];
  talent: string | null;
  prototype: boolean;
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

export const sampleGear: GearPiece[] = [
  { id: "g1", slot: "mask", brand: "Fox's Prayer", brandType: "brand", core: "Waffenschaden +15 %", attributes: ["CHD +12 %"], talent: null, prototype: false },
  { id: "g2", slot: "mask", brand: "Grupo Sombra", brandType: "brand", core: "Waffenschaden +15 %", attributes: ["CHC +6 %"], talent: null, prototype: false },
  { id: "g3", slot: "mask", brand: "Coyote's Mask", brandType: "exotic", core: "Waffenschaden +15 %", attributes: ["Fix: CHC +8 %"], talent: "Coyote's Discipline (Exotic)", prototype: false },
  { id: "g4", slot: "chest", brand: "Umbra Initiative", brandType: "brand", core: "Waffenschaden +15 %", attributes: ["CHC +6 %", "CHD +6 %"], talent: "Obliterate", prototype: false },
  { id: "g5", slot: "chest", brand: "Catharaxis (Named)", brandType: "named", core: "Panzerung +15 %", attributes: ["CHD +12 %"], talent: "Intimidate (Perfect)", prototype: false },
  { id: "g6", slot: "chest", brand: "Tip of the Spear", brandType: "gearset", core: "Waffenschaden +15 %", attributes: ["CHC +6 %"], talent: "Vigilance", prototype: false },
  { id: "g7", slot: "holster", brand: "Walker, Harris & Co.", brandType: "brand", core: "Waffenschaden +15 %", attributes: ["CHD +6 %"], talent: null, prototype: false },
  { id: "g8", slot: "holster", brand: "Foundry Bulwark", brandType: "gearset", core: "Panzerung +15 %", attributes: ["Panzerung +6 %"], talent: null, prototype: false },
  { id: "g9", slot: "holster", brand: "Grupo Sombra", brandType: "brand", core: "Kritischer Trefferschaden +15 %", attributes: ["CHC +6 %"], talent: null, prototype: false },
  { id: "g10", slot: "backpack", brand: "Umbra Initiative", brandType: "brand", core: "Waffenschaden +15 %", attributes: ["CHC +6 %"], talent: "Vigilance", prototype: false },
  { id: "g11", slot: "backpack", brand: "Ryang & Sachs (Named: Phantom)", brandType: "named", core: "Waffenschaden +15 %", attributes: ["CHD +12 %"], talent: "Composure (Perfect)", prototype: false },
  { id: "g12", slot: "backpack", brand: "Future Initiative", brandType: "gearset", core: "Panzerung +15 %", attributes: ["Skill-Hastung +6 %"], talent: "Skilled", prototype: false },
  { id: "g13", slot: "gloves", brand: "Contractor's Gloves", brandType: "named", core: "Waffenschaden +15 %", attributes: ["CHD +12 %"], talent: null, prototype: false },
  { id: "g14", slot: "gloves", brand: "Fox's Prayer", brandType: "brand", core: "Waffenschaden +15 %", attributes: ["CHC +6 %"], talent: null, prototype: false },
  { id: "g15", slot: "gloves", brand: "Petrov Defense Group", brandType: "brand", core: "Waffenschaden +15 %", attributes: ["LMG-Schaden +6 %"], talent: null, prototype: false },
  { id: "g16", slot: "kneepads", brand: "Walker, Harris & Co.", brandType: "brand", core: "Waffenschaden +15 %", attributes: ["CHD +6 %"], talent: null, prototype: false },
  { id: "g17", slot: "kneepads", brand: "Fenris Group AB (Named: Vault)", brandType: "named", core: "Panzerung +15 %", attributes: ["CHC +6 %"], talent: "Perfect Adrenaline Rush", prototype: false },
  { id: "g18", slot: "kneepads", brand: "Eclipse Protocol", brandType: "gearset", core: "Kritischer Trefferschaden +15 %", attributes: ["Status-Effekte +6 %"], talent: null, prototype: false },
  { id: "g19", slot: "chest", brand: "Gila Guard (Prototype)", brandType: "brand", core: "Panzerung +15 %", attributes: ["Prototyp-Attribut"], talent: "Endlessly (Prototype)", prototype: true },
  { id: "g20", slot: "backpack", brand: "Memento", brandType: "exotic", core: "Waffenschaden +15 %", attributes: ["Fix: CHD +10 %"], talent: "Got Your Back (Exotic)", prototype: false },
];

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
  { id: "b4", name: "Grupo Sombra", bonuses: [{ pieces: 2, bonus: "Kritischer Trefferschaden +15 %" }, { pieces: 3, bonus: "Kritische Trefferchance +10 %" }] },
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
