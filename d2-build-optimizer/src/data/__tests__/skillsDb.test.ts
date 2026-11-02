import { describe, it, expect } from "vitest";
import { SKILLS } from "../v4Data";
import skillsDb from "../../db/skills.json";

describe("CR-02: vollständige Skill-DB (division2_skills.json, v3)", () => {
  it("11 Skills, 41+ Varianten, jede mit 7 Tiers (0–6)", () => {
    expect(SKILLS.length).toBe(11 + 1); // 11 neue + Heilwerfer (bestehend)
    const total = SKILLS.reduce((n, s) => n + s.variants.length, 0);
    expect(total).toBeGreaterThanOrEqual(44);
    for (const s of SKILLS) {
      for (const v of s.variants) {
        const tiers = (v as unknown as { tiers?: Record<string, unknown> }).tiers;
        if (tiers) {
          expect(Object.keys(tiers)).toHaveLength(7);
          const t6 = (tiers as Record<string, { effekt_skalierung: number }>)["Tier_6"];
          expect(t6.effekt_skalierung).toBeGreaterThan(1);
        }
      }
    }
  });

  it("neue Skills Haftbombe + Falle sind vorhanden, Köder hat 1 Variante", () => {
    const keys = SKILLS.map((s) => s.key);
    expect(keys).toContain("haftbombe");
    expect(keys).toContain("falle");
    expect(keys).toContain("decoy");
    const pulse = SKILLS.find((s) => s.key === "pulse")!;
    expect(pulse.variants.map((v) => v.key).sort()).toEqual(
      ["achilles_impulsgeber", "banshee_impulsgeber", "fernscanner_impulsgeber", "jammer", "agent", "standard"].sort(),
    );
  });

  it("bestehende Variant-Keys bleiben stabil (Abwärtskompatibilität)", () => {
    const hive = SKILLS.find((s) => s.key === "hive")!;
    for (const k of ["restorer", "reviver", "booster", "stinger"]) {
      expect(hive.variants.some((v) => v.key === k)).toBe(true);
    }
    const chem = SKILLS.find((s) => s.key === "chem_launcher")!;
    for (const k of ["oxidizer", "reinforcer", "riot_foam", "firestarter"]) {
      expect(chem.variants.some((v) => v.key === k)).toBe(true);
    }
  });

  it("DB-Version ist v3", () => {
    expect((skillsDb as { version: string }).version).toBe("v3");
  });
});
