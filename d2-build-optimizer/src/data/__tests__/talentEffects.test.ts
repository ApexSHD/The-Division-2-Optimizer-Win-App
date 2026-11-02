import { describe, it, expect } from "vitest";
import {
  collectTalentContributions,
  weaponTalentEffect,
  DEFAULT_TALENT_ASSUMPTIONS,
} from "../talentEffects";
import { evaluateBuild, enemyProfileFromSettings } from "../damage";
import { DEFAULT_OPTIMIZATION } from "../../store";
import { sampleWeapons, type GearPiece, type GearSlot } from "../sampleData";

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
    expect(c.unmodelled).toContain("Einschüchtern");
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
