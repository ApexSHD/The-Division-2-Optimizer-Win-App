import type { Db, WeaponPreset, TalentEntry, GearPreset, GearTalentEntry } from "./db";

export type BrandSetRow = Db["brandSets"][number];
export type GearSetRow = Db["gearSets"][number];
export type ModRow = Db["mods"][number];

export interface UserDbOverrides {
  weapons: Record<string, Partial<WeaponPreset> | null>;
  weaponTalents: Record<string, Partial<TalentEntry> | null>;
  gear: Record<string, Partial<GearPreset> | null>;
  gearTalents: Record<string, Partial<GearTalentEntry> | null>;
  brandSets: Record<string, Partial<BrandSetRow> | null>;
  gearSets: Record<string, Partial<GearSetRow> | null>;
  mods: Record<string, Partial<ModRow> | null>;
}

export function emptyUserDb(): UserDbOverrides {
  return {
    weapons: {},
    weaponTalents: {},
    gear: {},
    gearTalents: {},
    brandSets: {},
    gearSets: {},
    mods: {},
  };
}

export function sanitizeUserDb(raw: unknown): UserDbOverrides {
  const out = emptyUserDb();
  if (typeof raw !== "object" || raw === null) return out;
  const r = raw as Partial<Record<keyof UserDbOverrides, unknown>>;
  (Object.keys(out) as (keyof UserDbOverrides)[]).forEach((k) => {
    const v = r[k];
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      (out as unknown as Record<string, unknown>)[k] = v;
    }
  });
  return out;
}

function mergeByKey<T>(
  base: T[],
  overrides: Record<string, Partial<T> | null> | undefined,
  keyOf: (item: T) => string,
  makeNew: (key: string) => T,
): T[] {
  const result: T[] = [];
  const handled = new Set<string>();
  for (const item of base) {
    const key = keyOf(item);
    handled.add(key);
    const o = overrides?.[key];
    if (o === null) continue;
    result.push(o ? { ...item, ...o } : item);
  }
  for (const [key, o] of Object.entries(overrides ?? {})) {
    if (handled.has(key) || !o) continue;
    result.push({ ...makeNew(key), ...o });
  }
  return result;
}

const newWeapon = (name: string): WeaponPreset => ({
  name,
  typeKey: "ar",
  isExotic: false,
  isNamed: false,
  baseDamage: 0,
  rpm: 0,
  magSize: 0,
  modSlotCount: 0,
  talent: null,
  note: "",
});

const newWeaponTalent = (key: string): TalentEntry => ({
  key,
  name: key,
  label: key,
  weaponTypes: [],
  group: "",
  description: "",
});

const newGear = (name: string): GearPreset => ({
  name,
  slot: "mask",
  brand: "",
  cls: "named",
  core: "any",
  fixedAttrs: [],
  namedSpecialAttr: null,
  perk: "",
  proto: false,
});

const newGearTalent = (key: string): GearTalentEntry => ({
  key,
  slot: "chest",
  label: key,
  note: "",
});

const newBrandSet = (key: string): BrandSetRow => ({ key, name: key, bonuses: [] });
const newGearSet = (key: string): GearSetRow => ({ key, name: key, bonuses: [] });
const newMod = (name: string): ModRow => ({ name, slot: "optic", slotTypes: [], bonus: "", penalty: null });

export function mergeDb(base: Db, overrides: UserDbOverrides | undefined): Db {
  if (!overrides) return base;
  const brandSets = mergeByKey(base.brandSets, overrides.brandSets, (b) => b.key, newBrandSet);
  const gearSets = mergeByKey(base.gearSets, overrides.gearSets, (s) => s.key, newGearSet);
  const allSlots = ["mask", "chest", "holster", "backpack", "gloves", "kneepads"] as const;
  return {
    ...base,
    weapons: mergeByKey(base.weapons, overrides.weapons, (w) => w.name, newWeapon),
    talents: mergeByKey(base.talents, overrides.weaponTalents, (t) => t.key, newWeaponTalent),
    gear: mergeByKey(base.gear, overrides.gear, (g) => g.name, newGear),
    gearTalents: mergeByKey(base.gearTalents, overrides.gearTalents, (g) => g.key, newGearTalent),
    brandSets,
    gearSets,
    brandItems: brandSets.map((b) => ({ brand: b.name, slots: [...allSlots] })),
    gearSetItems: gearSets.map((s) => ({ key: s.key, name: s.name, slots: [...allSlots] })),
    mods: mergeByKey(base.mods, overrides.mods, (m) => m.name, newMod),
  };
}

export function parseBonusLines(text: string): { pieces: number; bonus: string }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(\d+)\s*[×x:]\s*(.+)$/);
      return m ? { pieces: Number(m[1]), bonus: m[2].trim() } : { pieces: 1, bonus: line };
    });
}

export function formatBonusLines(bonuses: { pieces: number; bonus: string }[]): string {
  return bonuses.map((b) => `${b.pieces}× ${b.bonus}`).join("\n");
}
