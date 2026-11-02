import { describe, it, expect } from "vitest";
import { getDb } from "../db";
import { mergeDb, emptyUserDb, type UserDbOverrides } from "../userDb";

describe("CR-02 Admin: Skills editierbar über userDb.skills", () => {
  it("Db enthält skills (v3, 12 Skills) und versions.skills", async () => {
    const db = await getDb();
    expect(db.skills.length).toBeGreaterThanOrEqual(12);
    expect(db.versions.skills).toBe("v3");
  });

  it("Override ändert Skill-Namen und ergänzt Variante; Reset (null) stellt Basis wieder her", async () => {
    const base = await getDb();
    const overrides: UserDbOverrides = {
      ...emptyUserDb(),
      skills: {
        pulse: {
          name: "Impulsgeber (TEST)",
          variants: [{ key: "standard", name: "Standard (TEST)", effect_type: "cc" }],
        },
      },
    };
    const merged = mergeDb(base, overrides);
    const pulse = merged.skills.find((s) => s.key === "pulse")!;
    expect(pulse.name).toBe("Impulsgeber (TEST)");
    expect(pulse.variants.find((v) => v.key === "standard")!.name).toBe("Standard (TEST)");
    // nicht überschriebene Varianten bleiben erhalten
    expect(pulse.variants.some((v) => v.key === "jammer")).toBe(true);

    const reset = mergeDb(base, { ...emptyUserDb(), skills: { pulse: null } });
    expect(reset.skills.find((s) => s.key === "pulse")!.name).toBe("Impulsgeber");
  });

  it("neuer Skill per Override wird angehängt", async () => {
    const base = await getDb();
    const overrides: UserDbOverrides = {
      ...emptyUserDb(),
      skills: {
        test_skill: { key: "test_skill", name: "Test-Skill", variants: [{ key: "v1", name: "V1", effect_type: "damage" }] },
      },
    };
    const merged = mergeDb(base, overrides);
    expect(merged.skills.some((s) => s.key === "test_skill")).toBe(true);
  });
});
