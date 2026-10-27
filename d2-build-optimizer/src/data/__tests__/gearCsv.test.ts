import { describe, it, expect } from "vitest";
import { gearToCsv, gearFromCsv } from "../gearCsv";
import { normalizeGear } from "../sampleData";
import type { GearPiece } from "../sampleData";

const mkGear = (over: Partial<GearPiece> = {}): GearPiece =>
  normalizeGear({
    id: "test-1",
    slot: "mask",
    brand: "Testbrand",
    brandType: "brand",
    core: "wd",
    coreValue: 11.7,
    attributes: [
      { type: "chc", value: 4.2 },
      { type: "chd", value: 8.9 },
    ],
    talent: null,
    prototype: true,
    ...over,
  });

describe("Gear-CSV Roundtrip (Issue #76)", () => {
  it("Kernwert ueberlebt Export+Import (kein stilles God-Roll)", () => {
    const original = mkGear();
    const csv = gearToCsv([original]);
    const { gear } = gearFromCsv(csv, () => "imported-1");
    expect(gear).toHaveLength(1);
    expect(gear[0].coreValue).toBeCloseTo(11.7, 6);
  });

  it("Attributwerte ueberleben Export+Import", () => {
    const original = mkGear();
    const csv = gearToCsv([original]);
    const { gear } = gearFromCsv(csv, () => "imported-1");
    expect(gear[0].attributes[0].value).toBeCloseTo(4.2, 6);
    expect(gear[0].attributes[1].value).toBeCloseTo(8.9, 6);
  });

  it("parseGermanNumber: 6.5 bleibt 6.5 (nicht 65)", () => {
    // via Import mit englischem Dezimalpunkt
    const csv = ["Slot;Marke/Set;Besonderheit;Prototyp;1. Attribut;2. Attribut;3. Attribut;Talent",
                 "Maske;Testbrand;High-End;ja;Waffenschaden +12;Kritische Trefferchance +6.5;Kritischer Trefferschaden +8;"].join("\r\n");
    const { gear } = gearFromCsv(csv, () => "imported-1");
    expect(gear).toHaveLength(1);
    const chc = gear[0].attributes.find((a) => a.type === "chc");
    expect(chc?.value).toBeCloseTo(6.5, 6);
  });

  it("Brand-Set wird nicht mehr als Gear-Set fehlklassifiziert", () => {
    const csv = ["Slot;Marke/Set;Besonderheit;Prototyp;1. Attribut;2. Attribut;3. Attribut;Talent",
                 "Maske;Testbrand;Brand-Set;ja;Waffenschaden +12;Kritische Trefferchance +6;Kritischer Trefferschaden +8;"].join("\r\n");
    const { gear } = gearFromCsv(csv, () => "imported-1");
    expect(gear[0].brandType).toBe("brand");
  });

  it("Gear-Set bleibt Gear-Set", () => {
    const csv = ["Slot;Marke/Set;Besonderheit;Prototyp;1. Attribut;2. Attribut;3. Attribut;Talent",
                 "Maske;Testset;Gear-Set;ja;Waffenschaden +12;Kritische Trefferchance +6;Kritischer Trefferschaden +8;"].join("\r\n");
    const { gear } = gearFromCsv(csv, () => "imported-1");
    expect(gear[0].brandType).toBe("gearset");
  });
});
