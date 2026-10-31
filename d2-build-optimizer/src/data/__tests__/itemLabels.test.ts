import { describe, it, expect } from "vitest";
import { gearShortLabel, weaponShortLabel, findGearDuplicates, gearValueFingerprint } from "../itemLabels";
import { normalizeGear, sampleWeapons } from "../sampleData";
import type { GearPiece, GearSlot } from "../sampleData";

const mkGear = (slot: GearSlot, over: Partial<GearPiece> = {}): GearPiece =>
  normalizeGear({
    id: `g-${Math.random().toString(36).slice(2, 8)}`,
    slot,
    brand: "Striker's Battlegear",
    brandType: "brand",
    core: "wd",
    coreValue: 15,
    attributes: [
      { type: "chc", value: 6 },
      { type: "chd", value: 12 },
    ],
    talent: null,
    prototype: true,
    ...over,
  });

describe("Auto-Kurzlabel (INV-4)", () => {
  it("enthalat Marke, Slot, Kern und Attribute", () => {
    const label = gearShortLabel(mkGear("mask"));
    expect(label).toContain("Striker's Battlegear");
    expect(label).toContain("Maske");
    expect(label).toContain("Waffenschaden");
    expect(label).toContain("CHC 6");
    expect(label).toContain("CHD 12");
  });

  it("gleiche Marke, unterschiedliche Werte bleiben unterscheidbar", () => {
    const a = gearShortLabel(mkGear("mask", { coreValue: 15 }));
    const b = gearShortLabel(mkGear("mask", { coreValue: 12 }));
    expect(a).not.toBe(b);
  });

  it("Waffen-Label mit Name, Gattung, Talent, Prototyp", () => {
    const w = { ...sampleWeapons[0], talent: "Strained", isPrototype: true };
    const label = weaponShortLabel(w);
    expect(label).toContain(w.name);
    expect(label).toContain("AR");
    expect(label).toContain("Strained");
    expect(label).toContain("Prototyp");
  });
});

describe("Duplikat-Erkennung (Builds-Picker)", () => {
  it("identische Teile werden als Duplikate erkannt, unterschiedliche nicht", () => {
    const dup1 = mkGear("mask", { coreValue: 15 });
    const dup2 = mkGear("mask", { coreValue: 15 });
    const unique = mkGear("chest", { coreValue: 11 });
    const info = findGearDuplicates([dup1, dup2, unique]);
    expect(info.duplicateIds.has(dup1.id)).toBe(true);
    expect(info.duplicateIds.has(dup2.id)).toBe(true);
    expect(info.duplicateIds.has(unique.id)).toBe(false);
  });

  it("Fingerprint ignoriert die id", () => {
    const a = mkGear("holster");
    const b = { ...a, id: "andere-id" };
    expect(gearValueFingerprint(a)).toBe(gearValueFingerprint(b));
  });

  it("Talent-Unterschied verhindert Duplikat-Erkennung", () => {
    const a = mkGear("mask");
    const b = mkGear("mask", { talent: "Vigilance" });
    const info = findGearDuplicates([a, b]);
    expect(info.duplicateIds.size).toBe(0);
  });
});
