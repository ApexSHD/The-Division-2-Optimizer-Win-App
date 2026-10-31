import { describe, it, expect } from "vitest";
import {
  checkLoadoutIntegrity,
  buildCodeFromLoadout,
  weaponFingerprint,
  gearFingerprint,
} from "../loadoutIntegrity";
import type { Loadout, Weapon, GearPiece } from "../sampleData";
import { normalizeGear, normalizeWeapon, sampleWeapons } from "../sampleData";
import { DB_VERSION } from "../sampleData";

const weapon: Weapon = normalizeWeapon({ id: "w1", name: "Test-Waffe", type: "ar" });
const gear: GearPiece = normalizeGear({
  id: "g1",
  slot: "mask",
  brand: "Grupo Sombra S.A.",
  brandType: "brand",
  core: "wd",
  coreValue: 15,
  attributes: [
    { type: "chc", value: 5 },
    { type: "chd", value: 12 },
  ],
  talent: null,
  prototype: true,
});

function makeLoadout(over: Partial<Loadout> = {}): Loadout {
  return {
    id: "b1",
    name: "Test-Loadout",
    weaponIds: ["w1"],
    gearIds: { mask: "g1" },
    note: "",
    timestamp: "2026-10-31T00:00:00.000Z",
    roleId: "dps_krit",
    assumptions: [],
    metrics: { dps: 1_000_000, chc: 54.9, chd: 123, wd: 40, hsd: 25, armor: 200_000 },
    dbVersion: DB_VERSION,
    signatures: {
      w1: weaponFingerprint(weapon),
      g1: gearFingerprint(gear),
    },
    ...over,
  };
}

describe("VER-5: Loadout-Veraltung (Issue #118)", () => {
  it("aktuelles Loadout ohne Änderungen ist nicht veraltet", () => {
    const integrity = checkLoadoutIntegrity(makeLoadout(), [weapon], [gear], DB_VERSION);
    expect(integrity.outdated).toBe(false);
    expect(integrity.reasons).toHaveLength(0);
  });

  it("fehlende Teile (gelöscht) markieren das Loadout als veraltet", () => {
    const integrity = checkLoadoutIntegrity(makeLoadout(), [weapon], [], DB_VERSION);
    expect(integrity.outdated).toBe(true);
    expect(integrity.missingGearIds).toContain("g1");
    expect(integrity.reasons.some((r) => r.includes("nicht mehr im Inventar"))).toBe(true);
  });

  it("geänderte Teile werden über den Fingerabdruck erkannt", () => {
    const changedGear: GearPiece = { ...gear, coreValue: 20 };
    const integrity = checkLoadoutIntegrity(makeLoadout(), [weapon], [changedGear], DB_VERSION);
    expect(integrity.outdated).toBe(true);
    expect(integrity.changedGearIds).toContain("g1");
  });

  it("Datenbank-Update markiert das Loadout als veraltet", () => {
    const integrity = checkLoadoutIntegrity(makeLoadout(), [weapon], [gear], "weapons_v2 · gear_v2 · mods_v2");
    expect(integrity.outdated).toBe(true);
    expect(integrity.dbOutdated).toBe(true);
    expect(integrity.reasons.some((r) => r.includes("Datenbank aktualisiert"))).toBe(true);
  });

  it("Loadouts ohne Fingerabdrücke (Altbestand) erkennen nur Löschungen/DB-Wechsel", () => {
    const legacy = makeLoadout({ signatures: undefined });
    const changedGear: GearPiece = { ...gear, coreValue: 20 };
    expect(checkLoadoutIntegrity(legacy, [weapon], [changedGear], DB_VERSION).outdated).toBe(false);
    expect(checkLoadoutIntegrity(legacy, [weapon], [], DB_VERSION).outdated).toBe(true);
  });
});

describe("VER-6: Build-Code und Textexport (Issue #118)", () => {
  it("Build-Code ist ein D2BO-Präfix + Base64-Payload mit Name/IDs/Metrik", () => {
    const { code } = buildCodeFromLoadout(makeLoadout(), [weapon], [gear]);
    expect(code.startsWith("D2BO-")).toBe(true);
    const payload = JSON.parse(decodeURIComponent(escape(atob(code.slice(5)))));
    expect(payload.n).toBe("Test-Loadout");
    expect(payload.w).toEqual(["w1"]);
    expect(payload.g).toEqual({ mask: "g1" });
    expect(payload.m.dps).toBe(1_000_000);
  });

  it("Textexport enthält Name, Waffe, Gear und Kennzahlen", () => {
    const { text } = buildCodeFromLoadout(makeLoadout(), [weapon], [gear]);
    expect(text).toContain("Loadout: Test-Loadout");
    expect(text).toContain("Waffe: Test-Waffe (AR");
    expect(text).toContain("Grupo Sombra S.A. (mask)");
    expect(text).toContain("CHC: 54,9 %");
  });

  it("Fingerabdrücke unterscheiden sich bei Änderungen", () => {
    expect(weaponFingerprint(weapon)).not.toBe(weaponFingerprint({ ...weapon, baseDamage: 999 }));
    expect(gearFingerprint(gear)).not.toBe(gearFingerprint({ ...gear, coreValue: 20 }));
  });

  it("Beispielwaffen aus der DB haben stabile Fingerabdrücke", () => {
    const w = sampleWeapons[0];
    expect(weaponFingerprint(w)).toBe(weaponFingerprint({ ...w }));
  });
});
