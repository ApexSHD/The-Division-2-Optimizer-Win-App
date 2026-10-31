import { describe, it, expect } from "vitest";
import { computeDamage, evaluateBuild, bestModsForWeapon } from "../damage";
import { normalizeGear, normalizeWeapon, sampleWeapons } from "../sampleData";
import type { GearPiece } from "../sampleData";

const stats = { wd: 0, chc: 0, chd: 0, hsd: 0, dta: 0, dth: 0, dttooc: 0, totalWd: 0, amp: [], sources: {} };

describe("Waffen-Mods in der Berechnung (Mod-Erfassung)", () => {
  it("Magazin-Mod (+20 % Kapazität) vergroessert Magazin und Schaden/Magazin", () => {
    const base = { ...sampleWeapons[0], knowHow: 0, magSize: 30, rpm: 600, reloadSeconds: 3 };
    const without = computeDamage(base, stats, { armor: 0, health: 1, ooc: 0, headshot: 0 });
    const withMod = computeDamage(
      { ...base, equippedMods: [{ slot: "magazine" as const, attr: "capacity" as const, value: 20 }] },
      stats,
      { armor: 0, health: 1, ooc: 0, headshot: 0 },
    );
    expect(withMod.damagePerMagazine).toBeCloseTo(without.damagePerMagazine * 1.2, -2);
    expect(withMod.sustainedDps).toBeGreaterThan(without.sustainedDps);
  });

  it("Nachlade-Malus (Extended Mag -10 % Nachladetempo) verlaengert Nachladezeit", () => {
    const base = { ...sampleWeapons[0], knowHow: 0, magSize: 30, rpm: 600, reloadSeconds: 3 };
    const without = computeDamage(base, stats, { armor: 0, health: 1, ooc: 0, headshot: 0 });
    const withMod = computeDamage(
      { ...base, equippedMods: [{ slot: "magazine" as const, attr: "magSize" as const, value: 0, reloadPenalty: 10 }] },
      stats,
      { armor: 0, health: 1, ooc: 0, headshot: 0 },
    );
    // Nachladezeit 3s -> 3.3s: Dauer-DPS sinkt gegenueber gleichem Magazin
    expect(withMod.sustainedDps).toBeLessThan(without.sustainedDps);
  });

  it("erfasster Waffen-Mod schlaegt die automatische DB-Auswahl", () => {
    const weapon = normalizeWeapon({ id: "w-mod", name: "M", type: "ar" });
    const modsBySlot: Record<string, Array<{ name: string; slotTypes: string[]; bonus: { type: string; val: number } | null }>> = {
      optic: [{ name: "DB-Mod", slotTypes: [], bonus: { type: "chc", val: 5 } }],
    };
    const auto = bestModsForWeapon(weapon, modsBySlot);
    expect(auto[0]?.modName).toBe("DB-Mod");
    const equipped = normalizeWeapon({
      id: "w-mod",
      name: "M",
      type: "ar",
      equippedMods: [{ slot: "optic", attr: "hsd", value: 10 }],
    });
    const withEquipped = bestModsForWeapon(equipped, modsBySlot);
    expect(withEquipped[0]?.attr).toBe("hsd");
    expect(withEquipped[0]?.value).toBe(10);
  });
});

describe("Gear-Mods in der Berechnung (Mod-Erfassung)", () => {
  const mkGear = (mod?: { attr: "chc" | "chd" | "hsd"; value: number }): GearPiece =>
    normalizeGear({
      id: "g-mod",
      slot: "mask",
      brand: "Grupo Sombra S.A.",
      brandType: "brand",
      core: "wd",
      coreValue: 15,
      attributes: [],
      talent: null,
      prototype: false,
      mod: mod ?? null,
    });

  it("erfasster Gear-Mod (CHC 6) landet in den Stats mit Quellenangabe", () => {
    const ctx = {
      shdLevel: 1000,
      profile: { armor: 0, health: 1, ooc: 0, headshot: 0 },
      spec: "",
      setBonusCatalog: null,
    };
    const { stats: without } = evaluateBuild(sampleWeapons[0], [mkGear()], ctx);
    const { stats: withMod } = evaluateBuild(sampleWeapons[0], [mkGear({ attr: "chc", value: 6 })], ctx);
    expect(withMod.chc).toBeCloseTo(without.chc + 6, 6);
    expect(withMod.sources.chc?.some((src) => src.label.includes("Mod:"))).toBe(true);
  });
});
