import { describe, it, expect } from "vitest";
import { skillToValue, valueToSkill, emptySkillValue, variantToDraft } from "../SkillEditor";
import { SKILLS } from "../../../data/v4Data";

describe("SkillEditor: strukturierte Konvertierung (kein JSON mehr nötig)", () => {
  it("skillToValue/valueToSkill roundtrip erhält Key, Name, Varianten und Tiers", () => {
    const pulse = SKILLS.find((s) => s.key === "pulse")!;
    const v = skillToValue(pulse);
    expect(v.key).toBe("pulse");
    expect(v.variants.length).toBe(pulse.variants.length);
    for (const variant of v.variants) {
      expect(variant.tiers).toHaveLength(7);
      expect(variant.tiers[6].tier).toBe("Tier_6");
    }
    const back = valueToSkill(v);
    expect(back.key).toBe("pulse");
    expect(back.variants.map((x) => x.key).sort()).toEqual(pulse.variants.map((x) => x.key).sort());
    const std = back.variants.find((x) => x.key === "standard")!;
    const stdOrig = pulse.variants.find((x) => x.key === "standard")!;
    const tiers = (std as unknown as { tiers: Record<string, { effekt_skalierung: number }> }).tiers;
    const tiersOrig = (stdOrig as unknown as { tiers?: Record<string, { effekt_skalierung: number }> }).tiers;
    if (tiersOrig) {
      expect(tiers["Tier_6"].effekt_skalierung).toBeCloseTo(tiersOrig["Tier_6"].effekt_skalierung, 5);
    }
  });

  it("valueToSkill filtert leere Varianten-Keys und füllt Defaults", () => {
    const v = emptySkillValue("test");
    v.variants.push({ key: "", name: "", effect_type: "damage", duration: null, cooldown: null, charges: null, description: "", tiers: [] });
    v.variants.push({ key: "ok", name: "", effect_type: "cc", duration: 5, cooldown: 30, charges: 2, description: "x", tiers: [] });
    const back = valueToSkill(v);
    expect(back.variants).toHaveLength(1);
    expect(back.variants[0].key).toBe("ok");
    expect(back.variants[0].name).toBe("ok");
    expect(back.variants[0].duration).toBe(5);
  });

  it("variantToDraft baut 7 Tiers aus der DB-Variante", () => {
    const pulse = SKILLS.find((s) => s.key === "pulse")!;
    const d = variantToDraft(pulse.variants[0]);
    expect(d.tiers).toHaveLength(7);
    expect(d.tiers[0].effekt_skalierung).toBe(1);
  });
});
