import { describe, it, expect } from "vitest";
import { gearFromCsv } from "../gearCsv";
import { weaponsFromCsv } from "../weaponCsv";
import { GEAR_INVENTORY_CSV_1, WEAPON_INVENTORY_CSV_1 } from "./fixtures/cr02Fixtures";
import { optimizeV4, type ModeContext } from "../operatingModes";
import { computeInventoryCheck } from "../../views/optimizer/inventoryCheck";
import { DEFAULT_OPTIMIZATION } from "../../store";
import type { GearPiece, Weapon } from "../sampleData";

const gearCsv = GEAR_INVENTORY_CSV_1;
const weaponCsv = WEAPON_INVENTORY_CSV_1;

function load(): { gear: GearPiece[]; weapons: Weapon[] } {
  let s = 0;
  const id = () => `f${(s++).toString(36)}`;
  const g = gearFromCsv(gearCsv, id);
  const w = weaponsFromCsv(weaponCsv, id);
  return { gear: g.gear, weapons: w.weapons };
}

function ctx(overrides: Partial<ModeContext["settings"]> = {}): ModeContext {
  return {
    mode: "inventar",
    roleKey: "dps_krit",
    skills: [],
    teamSize: 4,
    shdLevel: 1000,
    settings: { ...DEFAULT_OPTIMIZATION, ...overrides },
    threatStatusShare: 0.3,
    spec: "sharpshooter",
  };
}

describe("CR-02 Fixtures (27 Gear / 19 Waffen)", () => {
  it("AK-Voraussetzung: 27 Gear, 19 Waffen, keine Pistole, 2 exotische Gear, 3 exotische Waffen", () => {
    const { gear, weapons } = load();
    expect(gear).toHaveLength(27);
    expect(weapons).toHaveLength(19);
    expect(weapons.filter((w) => w.type === "pistol")).toHaveLength(0);
    expect(gear.filter((g) => g.brandType === "exotic")).toHaveLength(2);
    expect(weapons.filter((w) => w.rarity === "exotic")).toHaveLength(3);
  });

  it("AK-5/AK-6: Ausschluss wird hart vor der Suche entfernt, Exotic-Gear-Limit ≤ 1", () => {
    const { gear, weapons } = load();
    const exotic = gear.find((g) => g.brandType === "exotic")!;
    const r = optimizeV4(weapons, gear, ctx({ excludedGearIds: [exotic.id] }), { maxResults: 10 });
    for (const c of r.candidates) {
      expect(c.gear.filter((g) => g.id === exotic.id)).toHaveLength(0);
      expect(c.gear.filter((g) => g.brandType === "exotic").length).toBeLessThanOrEqual(1);
    }
  });

  it("AK-7: gesperrtes Teil erscheint in jedem Ergebnis", () => {
    const { gear, weapons } = load();
    const locked = gear[0];
    const r = optimizeV4(weapons, gear, ctx({ lockedGearIds: [locked.id] }), { maxResults: 10 });
    expect(r.candidates.length).toBeGreaterThan(0);
    for (const c of r.candidates) {
      expect(c.gear.some((g) => g.id === locked.id)).toBe(true);
    }
  });
});

describe("CR-02 P2: Waffenpaar + Pistole (AK-4/AK-5)", () => {
  it("AK-4: Kandidat enthält 2 Primärwaffen, Pistole null mitInventar ohne Pistole", () => {
    const { gear, weapons } = load();
    const r = optimizeV4(weapons, gear, ctx(), { maxResults: 10 });
    expect(r.candidates.length).toBeGreaterThan(0);
    const c = r.candidates[0];
    const primaries = c.weapons.filter((x) => x.slot.startsWith("primary") && x.weapon);
    expect(primaries).toHaveLength(2);
    expect(c.weapons.find((x) => x.slot === "pistol")?.weapon).toBeNull();
  });

  it("AK-5: nie mehr als 1 exotische Waffe im Waffen-Setup", () => {
    const { gear, weapons } = load();
    const r = optimizeV4(weapons, gear, ctx(), { maxResults: 10 });
    for (const c of r.candidates) {
      const exoticWeapons = c.weapons.filter((x) => x.weapon?.rarity === "exotic").length;
      expect(exoticWeapons).toBeLessThanOrEqual(1);
    }
  });

  it("Rotation-Metrik: kombinierte DPS beider Primärwaffen wird als Score genutzt", () => {
    const { gear, weapons } = load();
    const r = optimizeV4(weapons, gear, ctx({ targetMetric: "rotation" }), { maxResults: 5 });
    expect(r.candidates.length).toBeGreaterThan(0);
    expect(r.candidates[0].weapons.filter((x) => x.weapon && x.slot.startsWith("primary"))).toHaveLength(2);
  });
});

describe("CR-02 AK-1/AK-8: Inventar-Check + Maßnahmenliste", () => {
  it("AK-1: DPS-Rollen möglich, Tank/Skill/Support nicht möglich (nur rote Kerne)", () => {
    const { gear, weapons } = load();
    const check = computeInventoryCheck(gear, weapons);
    const byKey = Object.fromEntries(check.roles.map((r) => [r.roleKey, r]));
    expect(byKey["dps_krit"].feasibility).toBe("possible");
    expect(byKey["dps_kopf"].feasibility).toBe("possible");
    expect(byKey["tank"].feasibility).toBe("impossible");
    expect(byKey["tank"].reason).toContain("blaue Kern");
    expect(byKey["skill_schaden"].feasibility).toBe("impossible");
    expect(check.missingWeaponTypes).toContain("MMR");
    expect(check.missingWeaponTypes).toContain("Pistole");
    expect(check.hasPistol).toBe(false);
  });

  it("AK-8: Rolle Tank liefert beste Näherung (kein Absturz, ranked nicht leer oder noAdmissibleHint gesetzt)", () => {
    const { gear, weapons } = load();
    const r = optimizeV4(weapons, gear, { ...ctx(), roleKey: "tank" }, { maxResults: 5 });
    expect(r.ranked.length + (r.noAdmissibleHint ? 1 : 0)).toBeGreaterThan(0);
    if (!r.best) {
      expect(r.noAdmissibleHint).toBeTruthy();
    }
  });
});
