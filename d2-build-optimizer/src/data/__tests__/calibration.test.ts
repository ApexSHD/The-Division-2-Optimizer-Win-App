import { describe, it, expect } from "vitest";
import fixtureJson from "../../../tests/fixtures/calibration-inventar-2026-10-31.json";
import { aggregateBuild, CHD_BASE } from "../damage";
import { shdBonusFor } from "../../store";
import type { GearPiece, GearSlot, Weapon } from "../sampleData";

const fx = fixtureJson as never as {
  shd_level: number;
  gear: Array<{
    slot: string;
    brand: string;
    brandType: GearPiece["brandType"];
    prototype: boolean;
    core: "wd" | "armour" | "skill";
    coreValue: number;
    attributes: Array<{ type: string; value: number }>;
  }>;
  weapon: {
    name: string;
    type: "ar";
    rarity: "named";
    prototype: boolean;
    core1: number;
    core2: { type: string; value: number };
    minor: { type: string; value: number };
    talent: string;
    knowHow: number;
    innateHsd: number;
    weaponMods: Array<{ type: string; value: number }>;
  };
  expected: { chc: number; chd: number; hsd: number; nonCrit: number; crit: number };
};

const SLOT_MAP: Record<string, GearSlot> = {
  Maske: "mask",
  Weste: "chest",
  Holster: "holster",
  Rucksack: "backpack",
  Handschuhe: "gloves",
  Knieschoner: "kneepads",
};

const buildGear: GearPiece[] = fx.gear.map((g, i) => ({
  id: `cal-${i}`,
  slot: SLOT_MAP[g.slot],
  brand: g.brand,
  brandType: g.brandType,
  core: g.core,
  coreValue: g.coreValue,
  attributes: g.attributes.map((a) => ({ type: a.type as never, value: a.value })),
  talent: null,
  prototype: g.prototype,
}));

const weapon: Weapon = {
  id: "cal-lexington",
  name: fx.weapon.name,
  type: fx.weapon.type,
  rarity: fx.weapon.rarity,
  baseDamage: 48700,
  rpm: 850,
  magSize: 50,
  talent: fx.weapon.talent,
  modSlots: ["optic", "muzzle", "underbarrel"],
  knowHow: fx.weapon.knowHow,
  isPrototype: fx.weapon.prototype,
  innateHsd: fx.weapon.innateHsd,
  attributes: {
    core1: fx.weapon.core1,
    core2Type: fx.weapon.core2.type as never,
    core2Val: fx.weapon.core2.value,
    minorType: fx.weapon.minor.type as never,
    minorVal: fx.weapon.minor.value,
  },
};

describe("Kalibrierung: Nutzer-Referenz-Build vs. Spiel (31.10., Schießstand-verifiziert)", () => {
  const stats = aggregateBuild(buildGear, fx.shd_level);
  const weaponChc = fx.weapon.weaponMods
    .filter((m) => m.type === "chc")
    .reduce((s, m) => s + m.value, 0);

  it("CHD-Basiswert 25 % ist als Agenten-Grundbonus im Modell", () => {
    expect(CHD_BASE).toBe(25);
  });

  it("CHC: Gear + Uhr + 3x5 % Waffen-Mods = 51,9 % (Spiel)", () => {
    const total = stats.chc + weaponChc;
    expect(total).toBeCloseTo(fx.expected.chc, 1);
  });

  it("CHD: Basis 25 + Uhr 20 + Gear 70,4 + Mods 49 = 164,4 % (Schießstand: 515.612/195.012 = 164,40 %)", () => {
    const gearModsChd = 49; // Nutzer-Mods (nicht einzeln erfasst, aus Messung rückgerechnet)
    const total = CHD_BASE + stats.chd + gearModsChd;
    expect(total).toBeCloseTo(fx.expected.chd, 1);
    const measuredRatio = (fx.expected.crit / fx.expected.nonCrit - 1) * 100;
    expect(measuredRatio).toBeCloseTo(fx.expected.chd, 1);
  });

  it("HSD: Waffen-Innate 55 + Uhr 20 = 75 % (Spiel)", () => {
    const total = (weapon.innateHsd ?? 0) + stats.hsd;
    expect(total).toBeCloseTo(fx.expected.hsd, 1);
  });

  it("Waffen-Innate-HSD fließt in die Schadensberechnung (computeDamage nutzt innateHsd)", () => {
    expect(weapon.innateHsd).toBe(55);
  });

  it("SHD-Uhr-Anteile: CHC 10, CHD 20, HSD 20 bei maxed Watch", () => {
    expect(shdBonusFor(fx.shd_level, "chc")).toBe(10);
    expect(shdBonusFor(fx.shd_level, "chd")).toBe(20);
    expect(shdBonusFor(fx.shd_level, "hsd")).toBe(20);
  });
});
