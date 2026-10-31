import { describe, it, expect } from "vitest";
import { resolveNameAlias } from "../aliasResolver";
import { gearFromCsv, gearToCsv } from "../gearCsv";
import { normalizeGear } from "../sampleData";
import type { GearPiece } from "../sampleData";
import { weaponsFromCsv, weaponsToCsv } from "../weaponCsv";
import { sampleWeapons } from "../sampleData";

describe("Alias-Tabelle (INV-3, Issue #114)", () => {
  it("löst exakte Aliasse auf: 'Grupo Shadow S.A.' -> 'Grupo Sombra S.A.'", () => {
    const r = resolveNameAlias("Grupo Shadow S.A.", "brands");
    expect(r.canonical).toBe("Grupo Sombra S.A.");
    expect(r.suggestionUsed).toBe(false);
  });

  it("löst Set-Aliasse auf: 'Striker' -> \"Striker's Battlegear\"", () => {
    const r = resolveNameAlias("Striker", "gearsets");
    expect(r.canonical).toBe("Striker's Battlegear");
  });

  it("schlägt bei Tippfehlern den ähnlichsten Eintrag vor", () => {
    const r = resolveNameAlias("Grupo Sombr", "brands");
    expect(r.canonical).toBe("Grupo Sombra S.A.");
    expect(r.suggestionUsed).toBe(true);
  });

  it("lässt unbekannte Namen unverändert", () => {
    const r = resolveNameAlias("Marke XYZ 12345", "brands");
    expect(r.canonical).toBe("Marke XYZ 12345");
    expect(r.suggestionUsed).toBe(false);
  });

  it("Alias-Warnung beim CSV-Import, Import wird nicht blockiert", () => {
    const csv = [
      "Slot;Marke;1. Attribut;2. Attribut;3. Attribut;Talent",
      "Maske;Grupo Shadow S.A.;Waffenschaden 15;Kritische Trefferchance 5;Kritischer Trefferschaden 8;",
    ].join("\n");
    const { gear, warnings } = gearFromCsv(csv, () => "imported-1");
    expect(gear).toHaveLength(1);
    expect(gear[0].brand).toBe("Grupo Sombra S.A.");
    expect(warnings.some((w) => w.includes("als „Grupo Sombra S.A.“ erkannt"))).toBe(true);
  });
});

describe("Verlustfreier CSV-Rundlauf inkl. Mods (INV-5/INV-7, Issue #114)", () => {
  it("Gear: Mod, Talent und Aliasse überleben Export+Import", () => {
    const original: GearPiece = normalizeGear({
      id: "roundtrip-1",
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
      mod: { attr: "chc", value: 3 },
    });
    const csv = gearToCsv([original]);
    const { gear } = gearFromCsv(csv, () => "re-1");
    expect(gear).toHaveLength(1);
    expect(gear[0].brand).toBe(original.brand);
    expect(gear[0].coreValue).toBeCloseTo(original.coreValue, 6);
    expect(gear[0].mod?.attr).toBe("chc");
    expect(gear[0].mod?.value).toBeCloseTo(3, 6);
  });

  it("Waffen: Mods, Kopfschuss-Grundwert und Nachladezeit überleben Export+Import", () => {
    const original = {
      ...sampleWeapons[0],
      talent: "Strained",
      innateHsd: 25,
      reloadSeconds: 2.1,
      equippedMods: [
        { slot: "optic" as const, attr: "chc" as const, value: 5 },
        { slot: "magazine" as const, attr: "chd" as const, value: 10 },
      ],
    };
    const csv = weaponsToCsv([original]);
    const { weapons } = weaponsFromCsv(csv, () => "re-1");
    expect(weapons).toHaveLength(1);
    const w = weapons[0];
    expect(w.innateHsd).toBe(25);
    expect(w.reloadSeconds).toBeCloseTo(2.1, 6);
    expect(w.equippedMods).toHaveLength(2);
    expect(w.equippedMods?.find((m) => m.slot === "optic")?.value).toBeCloseTo(5, 6);
    expect(w.equippedMods?.find((m) => m.slot === "magazine")?.attr).toBe("chd");
  });
});
