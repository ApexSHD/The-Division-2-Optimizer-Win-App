import { describe, it, expect } from "vitest";
import {
  collectTalentContributions,
  weaponTalentEffect,
  DEFAULT_TALENT_ASSUMPTIONS,
} from "../talentEffects";
import { evaluateBuild, enemyProfileFromSettings } from "../damage";
import { DEFAULT_OPTIMIZATION } from "../../store";
import { sampleWeapons, type GearPiece, type GearSlot } from "../sampleData";
import talentsDisplayJson from "../../db/talents-display.json";

function gearPiece(slot: GearSlot, talent: string | null, brand = "Test"): GearPiece {
  return {
    id: `${slot}-${brand}`,
    slot,
    brand,
    brandType: "brand",
    core: "wd",
    coreValue: 15,
    attributes: [{ type: "chc" as never, value: 6 }],
    talent,
    prototype: true,
  };
}

const ar = sampleWeapons.find((w) => w.type === "ar")!;

describe("CR-02 P4: Talentmodell (OP-6.2/OP-6.5, AK-17)", () => {
  it("Strapaziert: Stack-Klasse, +10 % CHD × 5 Stacks × stackUptime 0,8 = +40 % CHD", () => {
    const eff = weaponTalentEffect({ ...ar, talent: "Strapaziert" });
    expect(eff).not.toBeNull();
    expect(eff!.talentClass).toBe("stack");
    expect(eff!.category).toBe("chd");
    expect(eff!.value).toBe(40);
    expect(eff!.modeled).toBe(true);
  });

  it("Killer: bedingt, +70 % CHD × uptime 10/30 = +23,3 % CHD", () => {
    const eff = weaponTalentEffect({ ...ar, talent: "Killer" });
    expect(eff!.talentClass).toBe("conditional");
    expect(eff!.value).toBeCloseTo(23.3, 1);
  });

  it("Raserei: bedingt WD +15 % × 9/30 = +4,5 % WD", () => {
    const eff = weaponTalentEffect({ ...ar, talent: "Raserei" });
    expect(eff!.talentClass).toBe("conditional");
    expect(eff!.category).toBe("wd");
    expect(eff!.value).toBeCloseTo(4.5, 1);
  });

  it("Unbekanntes Talent: unmodelled, value 0, als unmodelled gekennzeichnet", () => {
    const eff = weaponTalentEffect({ ...ar, talent: "Komplett Unbekanntes Talent" });
    expect(eff!.talentClass).toBe("unmodelled");
    expect(eff!.modeled).toBe(false);
    expect(eff!.value).toBe(0);
  });

  it("collectTalentContributions: Waffe + Gear-Talente summiert, unmodelled gelistet", () => {
    const gear = [gearPiece("chest", "Einschüchtern", "Fenris")];
    const c = collectTalentContributions({ ...ar, talent: "Strapaziert" }, gear);
    expect(c.chdPercent).toBe(40);
    expect(c.weaponTalent?.name).toBe("Strapaziert");
    // Einschüchtern ist jetzt modelliert (Amp) — nicht mehr unmodelled
    expect(c.ampPercents.length).toBeGreaterThan(0);
  });

  it("evaluateBuild mit considerTalents=true rechnet Talent-CHD in den Schaden ein (OP-6.5)", () => {
    const profile = enemyProfileFromSettings(DEFAULT_OPTIMIZATION);
    const gear = [gearPiece("mask", null), gearPiece("chest", null), gearPiece("holster", null), gearPiece("backpack", null), gearPiece("gloves", null), gearPiece("kneepads", null)];
    const w = { ...ar, talent: "Strapaziert" };
    const off = evaluateBuild(w, gear, { shdLevel: 1000, profile, considerTalents: false });
    const on = evaluateBuild(w, gear, { shdLevel: 1000, profile, considerTalents: true });
    expect(on.damage.finalChd).toBeGreaterThan(off.damage.finalChd);
    expect(on.damage.finalChd - off.damage.finalChd).toBeCloseTo(40, 0);
    expect(on.damage.effectiveDps).toBeGreaterThan(off.damage.effectiveDps);
    const src = on.stats.sources["chd"] ?? [];
    expect(src.some((s) => s.label.includes("Talent"))).toBe(true);
  });

  it("Default-Annahmen sind dokumentiert und änderbar (OP-6.3)", () => {
    expect(DEFAULT_TALENT_ASSUMPTIONS.combatWindowSeconds).toBeGreaterThan(0);
    const relaxed = { ...DEFAULT_TALENT_ASSUMPTIONS, stackUptime: 0.5 };
    const eff = weaponTalentEffect({ ...ar, talent: "Strapaziert" }, relaxed);
    expect(eff!.value).toBe(25);
  });
});

describe("CR-02 P4 Paket 2: alle Talente + Exotic-Perks + Set-Stufen", () => {
  it("alle 131 Waffentalente aus talents-display.json sind entweder modelliert oder unmodelled — keine Lücke", () => {
    const display = talentsDisplayJson as unknown as Record<string, unknown>;
    const names: string[] = [];
    const walk = (o: unknown) => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === "object") {
        const r = o as Record<string, unknown>;
        if (typeof r.name === "string" && typeof r.description === "string") names.push(r.name);
        Object.values(r).forEach(walk);
      }
    };
    walk(display);
    expect(names.length).toBeGreaterThan(100);
    const ar = sampleWeapons.find((w) => w.type === "ar")!;
    let modeled = 0;
    let unmodelled = 0;
    for (const n of names) {
      const eff = weaponTalentEffect({ ...ar, talent: n });
      if (!eff) continue;
      if (eff.modeled) modeled++;
      else unmodelled++;
    }
    console.log(`talents-display: ${names.length} Namen, modelliert=${modeled}, unmodelled=${unmodelled}`);
    expect(modeled + unmodelled).toBe(names.length);
    expect(modeled).toBeGreaterThan(30);
  });

  it("Gear-Talente Weste+Rucksack: Einschüchtern (Intimidate) wird als Amp modelliert, Wachsamkeit als WD-Amp", () => {
    const g = (talent: string) => ({ id: "x", slot: "chest" as never, brand: "Fenris", brandType: "brand" as const, core: "wd" as const, coreValue: 15, attributes: [], talent, prototype: true });
    const c = collectTalentContributions(null, [g("Einschüchtern")]);
    expect(c.ampPercents.length).toBeGreaterThan(0);
    expect(c.ampPercents[0]).toBeCloseTo(35 * 0.5, 1);
    const c2 = collectTalentContributions(null, [{ ...g("Wachsamkeit (Vigilance)"), slot: "backpack" as never }]);
    expect(c2.ampPercents[0]).toBeCloseTo(25 * 0.8, 1);
  });

  it("Striker's Gamble (Gearset-4er-Talent): Stack 0,65 % × 100 × 0,8 = +52 % WD", () => {
    const g = (talent: string) => ({ id: "x", slot: "backpack" as never, brand: "Striker's Battlegear", brandType: "gearset" as const, core: "wd" as const, coreValue: 15, attributes: [], talent, prototype: true });
    const c = collectTalentContributions(null, [g("Striker's Gamble (Striker's Battlegear)")]);
    expect(c.wdPercent).toBeCloseTo(0.65 * 100 * 0.8, 1);
  });

  it("Exotic-Perk Catalyst: +2 % WD × 12 Stacks × 0,8 = +19,2 % WD; Memento: +24 % WD", () => {
    const cat = { id: "c", slot: "mask" as never, brand: "Catalyst", brandType: "exotic" as const, core: "wd" as const, coreValue: 15, attributes: [], talent: null, prototype: false };
    const mem = { ...cat, id: "m", slot: "backpack" as never, brand: "Memento" };
    const cc = collectTalentContributions(null, [cat]);
    expect(cc.wdPercent).toBeCloseTo(2 * 12 * 0.8, 1);
    const cm = collectTalentContributions(null, [mem]);
    expect(cm.wdPercent).toBeCloseTo(1 * 30 * 0.8, 1);
  });

  it("Unmodellierter Exotic-Perk (z. B. Tinkerer) wird gekennzeichnet", () => {
    const tink = { id: "t", slot: "mask" as never, brand: "Tinkerer", brandType: "exotic" as const, core: "wd" as const, coreValue: 15, attributes: [], talent: null, prototype: false };
    const c = collectTalentContributions(null, [tink]);
    expect(c.unmodelled.some((u) => u.includes("Tinkerer"))).toBe(true);
  });

  it("considerPerks=false blendet Exotic-Perks aus", () => {
    const cat = { id: "c", slot: "mask" as never, brand: "Catalyst", brandType: "exotic" as const, core: "wd" as const, coreValue: 15, attributes: [], talent: null, prototype: false };
    const off = collectTalentContributions(null, [cat], undefined, false);
    expect(off.wdPercent).toBe(0);
  });
});
