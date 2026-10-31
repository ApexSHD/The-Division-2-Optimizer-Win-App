import { describe, it, expect } from "vitest";
import {
  computeInventoryKpis,
  roleKings,
  randomBuildTip,
  ROLE_LABELS,
} from "../dashboardData";
import { normalizeGear, normalizeWeapon, gearAttrMax } from "../sampleData";
import type { GearPiece, GearSlot, Loadout } from "../sampleData";

const mkGear = (slot: GearSlot, over: Partial<GearPiece> = {}): GearPiece =>
  normalizeGear({
    id: `g-${slot}-${Math.random().toString(36).slice(2, 6)}`,
    slot,
    brand: "Grupo Sombra S.A.",
    brandType: "brand",
    core: "wd",
    coreValue: 15,
    attributes: [
      { type: "chc", value: 5.5 },
      { type: "chd", value: 11 },
    ],
    talent: null,
    prototype: true,
    ...over,
  });

const mkLoadout = (over: Partial<Loadout> = {}): Loadout => ({
  id: `b-${Math.random().toString(36).slice(2, 6)}`,
  name: "Test-Loadout",
  weaponIds: [],
  gearIds: {},
  note: "",
  timestamp: "2026-10-31T00:00:00.000Z",
  roleId: "dps_krit",
  assumptions: [],
  metrics: { dps: 1_000_000, chc: 50, chd: 100, wd: 30, hsd: 0, armor: 150_000 },
  dbVersion: "x",
  ...over,
});

describe("Dashboard-KPIs (Lastenheft Dashboard 3.1)", () => {
  it("zaehlt Gear/Waffen je Slot mit Kernfarben", () => {
    const gear = [mkGear("mask"), mkGear("mask", { core: "armour" }), mkGear("chest")];
    const kpis = computeInventoryKpis(gear, [], []);
    expect(kpis.gearTotal).toBe(3);
    expect(kpis.slots.find((s) => s.slot === "mask")?.count).toBe(2);
    expect(kpis.slots.find((s) => s.slot === "mask")?.cores.rot).toBe(1);
    expect(kpis.slots.find((s) => s.slot === "mask")?.cores.blau).toBe(1);
  });

  it("zaehlt Exotics, Gear-Sets und Marken getrennt", () => {
    const gear = [
      mkGear("mask", { brandType: "exotic", brand: "Coyote's Mask" }),
      mkGear("chest", { brandType: "gearset", brand: "Striker's Battlegear" }),
      mkGear("holster"),
    ];
    const kpis = computeInventoryKpis(gear, [], []);
    expect(kpis.exoticGear).toBe(1);
    expect(kpis.gearsets).toEqual([{ name: "Striker's Battlegear", count: 1 }]);
    expect(kpis.brands).toEqual([{ name: "Grupo Sombra S.A.", count: 1 }]);
  });

  it("Qualitaets-Metrik: Top-Teile >= 90 % des Max-Rolls", () => {
    const maxChc = gearAttrMax("chc", true) ?? 6;
    const topGear = mkGear("mask", { attributes: [{ type: "chc", value: maxChc }, { type: "chd", value: 1 }] });
    const lowGear = mkGear("chest", { attributes: [{ type: "chc", value: 1 }, { type: "chd", value: 1 }] });
    const kpis = computeInventoryKpis([topGear, lowGear], [], []);
    const chc = kpis.topParts.find((t) => t.attr === "chc");
    expect(chc?.topCount).toBe(1);
    expect(chc?.thresholdPercent).toBe(90);
  });

  it("Zero-Usage: Teile ohne Loadout-Nutzung werden erkannt (Safe-to-Junk)", () => {
    const used = mkGear("mask");
    const unused = mkGear("chest");
    const unusedWeapon = normalizeWeapon({ id: "w-unused", name: "U", type: "smg" });
    const loadout = mkLoadout({ gearIds: { mask: used.id } });
    const kpis = computeInventoryKpis([used, unused], [unusedWeapon], [loadout]);
    expect(kpis.zeroUsageGearIds).toEqual([unused.id]);
    expect(kpis.zeroUsageWeaponIds).toEqual([unusedWeapon.id]);
  });
});

describe("Rollen-Koenige (Dashboard 3.3)", () => {
  it("bester Loadout je Rolle nach DPS, sortiert", () => {
    const a = mkLoadout({ roleId: "dps_krit", name: "A", metrics: { dps: 100, chc: 0, chd: 0, wd: 0, hsd: 0, armor: 0 } });
    const b = mkLoadout({ roleId: "dps_krit", name: "B", metrics: { dps: 200, chc: 0, chd: 0, wd: 0, hsd: 0, armor: 0 } });
    const c = mkLoadout({ roleId: "armor_tank", name: "C", metrics: { dps: 50, chc: 0, chd: 0, wd: 0, hsd: 0, armor: 0 } });
    const kings = roleKings([a, b, c]);
    expect(kings).toHaveLength(2);
    expect(kings.find((k) => k.roleId === "dps_krit")?.loadout?.name).toBe("B");
    expect(kings.find((k) => k.roleId === "armor_tank")?.roleLabel).toBe(ROLE_LABELS.armor_tank);
    expect(kings[0].roleId).toBe("dps_krit");
  });
});

describe("Build-Tipp (Dashboard 3.6)", () => {
  it("liefert deterministisch Tipps je Seed und wechselt bei Klick", () => {
    const t1 = randomBuildTip([], 0);
    const t2 = randomBuildTip([], 0);
    expect(t1.text).toBe(t2.text);
    expect(randomBuildTip([], 1).text).not.toBe(t1.text);
  });

  it("zeigt Talente aus dem Inventar, wenn vorhanden und Seed gerade", () => {
    const gear = [mkGear("mask", { talent: "Vigilance" })];
    const tip = randomBuildTip(gear, 2);
    expect(tip.kind).toBe("talent");
    expect(tip.text).toContain("Vigilance");
  });
});
