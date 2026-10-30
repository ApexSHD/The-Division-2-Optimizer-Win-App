import { describe, it, expect } from "vitest";
import {
  optimizeV4,
  reachability,
  hasAggroTool,
  hasHealSkill,
  hasCcSkill,
  reduceSearchSpace,
  bestGearModsForRole,
  type ModeContext,
} from "../operatingModes";
import modsJson from "../../db/mod.json";
import type { SkillChoice } from "../axes";
import { roleProfile } from "../roleProfiles";
import { SKILLS } from "../v4Data";
import { sampleWeapons } from "../sampleData";
import { DEFAULT_OPTIMIZATION } from "../../store";
import type { GearPiece, GearSlot, Weapon } from "../sampleData";

function gear(
  slot: GearSlot,
  core: "wd" | "armour" | "skill",
  attrs: Array<{ type: string; value: number }> = [],
  id?: string,
): GearPiece {
  return {
    id: id ?? `${slot}-${core}-${Math.random().toString(36).slice(2, 7)}`,
    slot,
    brand: "Testmarke",
    brandType: "brand",
    core,
    coreValue: core === "armour" ? 170000 : core === "skill" ? 1 : 15,
    attributes: attrs.map((a) => ({ type: a.type as never, value: a.value })),
    talent: null,
    prototype: true,
  };
}

const restorerHive: SkillChoice = {
  skill: SKILLS.find((s) => s.key === "hive")!,
  variant: SKILLS.find((s) => s.key === "hive")!.variants.find((v) => v.key === "restorer")!,
};

const turret: SkillChoice = {
  skill: SKILLS.find((s) => s.key === "turret")!,
  variant: SKILLS.find((s) => s.key === "turret")!.variants[0],
};

const weapon: Weapon = sampleWeapons[0];

function inventar(): GearPiece[] {
  const slots: GearSlot[] = ["mask", "chest", "holster", "backpack", "gloves", "kneepads"];
  return slots.flatMap((slot) => [
    gear(slot, "wd", [{ type: "chc", value: 9 }], `${slot}-wd-1`),
    gear(slot, "wd", [{ type: "chd", value: 12 }], `${slot}-wd-2`),
    gear(slot, "skill", [{ type: "skilldmg", value: 10 }], `${slot}-sk-1`),
    gear(slot, "armour", [{ type: "hazard", value: 10 }], `${slot}-ar-1`),
  ]);
}

function modeCtx(overrides: Partial<ModeContext> = {}): ModeContext {
  return {
    mode: "inventar",
    roleKey: "dps_krit",
    skills: [turret],
    teamSize: 4,
    shdLevel: 0,
    settings: { ...DEFAULT_OPTIMIZATION, enemyHeadshotShare: 20 },
    threatStatusShare: 0.3,
    spec: "",
    ...overrides,
  };
}

describe("Betriebsarten & Suchraum V4 (Issue #92, Lastenheft Abschnitte 1.1 und 8)", () => {
  it("Inventar-Build: liefert zulässige Rangliste für DPS Krit", () => {
    const result = optimizeV4([weapon], inventar(), modeCtx());
    expect(result.ranked.length).toBeGreaterThan(0);
    expect(result.best).not.toBeNull();
    expect(result.best!.admissible).toBe(true);
    expect(result.role.key).toBe("dps_krit");
    expect(result.runtimeMs).toBeGreaterThanOrEqual(0);
  }, 30000);

  it("Ziel-Build: Suchraum wird per Slot-Ranking reduziert (Warnung mit Budget)", () => {
    const many = inventar().concat(
      (["mask", "chest", "holster"] as GearSlot[]).flatMap((slot) =>
        Array.from({ length: 20 }, (_, i) =>
          gear(slot, "wd", [{ type: "chd", value: 5 + (i % 5) }], `${slot}-fill-${i}`),
        ),
      ),
    );
    const result = optimizeV4([weapon], many, modeCtx({ mode: "ziel" }), { budgetPerSlot: 5 });
    expect(result.warnings.some((w) => w.includes("Suchraum reduziert"))).toBe(true);
    expect(result.ranked.length).toBeGreaterThan(0);
  }, 60000);

  it("Kriterium 17: Ziel-Build-Score ist nie niedriger als der Inventar-Build-Score (Obergrenze)", () => {
    const inv = optimizeV4([weapon], inventar().slice(0, 12), modeCtx({ mode: "inventar" }));
    const ziel = optimizeV4([weapon], inventar(), modeCtx({ mode: "ziel" }));
    const r = reachability(inv, ziel);
    expect(r.targetIsUpperBound).toBe(true);
    if (r.inventarScore !== null && r.zielScore !== null) {
      expect(r.zielScore).toBeGreaterThanOrEqual(r.inventarScore);
    }
  }, 60000);

  it("Erreichungsgrad: Prozentwert zwischen 0 und 100, reproduzierbar", () => {
    const inv = optimizeV4([weapon], inventar().slice(0, 6), modeCtx());
    const ziel = optimizeV4([weapon], inventar(), modeCtx({ mode: "ziel" }));
    const r1 = reachability(inv, ziel);
    const r2 = reachability(inv, ziel);
    expect(r1.reachabilityPercent).toBe(r2.reachabilityPercent);
    if (r1.reachabilityPercent !== null) {
      expect(r1.reachabilityPercent).toBeGreaterThanOrEqual(0);
      expect(r1.reachabilityPercent).toBeLessThanOrEqual(100);
    }
  }, 60000);

  it("Gleiche Eingabe ergibt gleiches Ergebnis (Wiederholprobe, Kriterium 4)", () => {
    const a = optimizeV4([weapon], inventar(), modeCtx());
    const b = optimizeV4([weapon], inventar(), modeCtx());
    expect(a.ranked.map((r) => r.id)).toEqual(b.ranked.map((r) => r.id));
  }, 60000);

  it("Laufzeit: Inventar-Build unter 5 s (Lastenheft-Abschnitt-8-Ziel, kleine Teilemenge)", () => {
    const start = Date.now();
    optimizeV4([weapon], inventar(), modeCtx());
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  }, 30000);

  it("Aggro-Werkzeug-Erkennung: Schild/Köder ja, Drohne nein", () => {
    const shield: SkillChoice = {
      skill: SKILLS.find((s) => s.key === "shield")!,
      variant: SKILLS.find((s) => s.key === "shield")!.variants[0],
    };
    const drone: SkillChoice = {
      skill: SKILLS.find((s) => s.key === "drone")!,
      variant: SKILLS.find((s) => s.key === "drone")!.variants[0],
    };
    expect(hasAggroTool([shield])).toBe(true);
    expect(hasAggroTool([drone])).toBe(false);
    expect(hasAggroTool([])).toBe(false);
  });

  it("Heil-/CC-Skill-Erkennung für Skill-Vorgaben", () => {
    expect(hasHealSkill([restorerHive])).toBe(true);
    expect(hasHealSkill([turret])).toBe(false);
    expect(hasCcSkill([turret])).toBe(false);
  });

  it("Skill-Heiler im Inventar-Modus: ohne Heil-Skill unzulässig mit Hinweis", () => {
    const result = optimizeV4([weapon], inventar(), modeCtx({ roleKey: "skill_heiler", skills: [turret] }));
    expect(result.skillHint).toContain("Heil-Skill");
    expect(result.ranked.length).toBeGreaterThan(0);
    const withHealSkill = optimizeV4([weapon], inventar(), modeCtx({ roleKey: "skill_heiler", skills: [restorerHive] }));
    expect(withHealSkill.skillHint).toBeNull();
  }, 30000);

  it("reduceSearchSpace behält Locks-relevante Teile und ist deterministisch", () => {
    const g = inventar();
    const role = roleProfile("dps_krit");
    const a = reduceSearchSpace(g, role, 3);
    const b = reduceSearchSpace(g, role, 3);
    expect(a.gear.map((x) => x.id)).toEqual(b.gear.map((x) => x.id));
    expect(a.pruned).toBe(b.pruned);
    for (const slot of ["mask", "chest", "holster", "backpack", "gloves", "kneepads"] as GearSlot[]) {
      expect(a.gear.filter((x) => x.slot === slot).length).toBeLessThanOrEqual(3);
    }
  });

  it("Rüstungs-Supporter: ohne Team-Rüstungsquelle kein zulässiges Build mit Hinweis (Kriterium 13)", () => {
    const g = inventar();
    const result = optimizeV4(
      [weapon],
      g.map((x) => ({ ...x, core: "armour" as const, coreValue: 170000 })),
      modeCtx({ roleKey: "ruestungs_supporter", skills: [restorerHive] }),
    );
    expect(result.noAdmissibleHint).toContain("Kein zulässiges Build");
  }, 30000);
});

describe("Gear-Mods (Maske, Weste, Rucksack) in der V4-Bewertung", () => {
  it("bestGearModsForRole: DPS Krit bekommt 3 CHC-Mods (6 % je Platz), Heiler Reparatur-Mods", () => {
    const krit = bestGearModsForRole("dps_krit");
    expect(krit).toHaveLength(3);
    expect(krit.every((m) => m.attr === "chc" && m.val === 6)).toBe(true);
    expect(krit.map((m) => m.slot).sort()).toEqual(["backpack", "chest", "mask"]);
    const heiler = bestGearModsForRole("skill_heiler");
    expect(heiler.every((m) => m.attr === "repair")).toBe(true);
    const tank = bestGearModsForRole("tank");
    expect(tank.every((m) => m.attr === "hazard")).toBe(true);
  });

  it("Krit-Build erreicht den CHC-Zielwert erst durch Gear-Mods (Issue: Mod-Plätze)", () => {
    const modSlots: GearSlot[] = ["mask", "chest", "holster", "backpack", "gloves", "kneepads"];
    const gearNoModEnough = modSlots.map((slot) =>
      gear(slot, "wd", [{ type: "chc", value: 6 }], `${slot}-modtest`),
    );
    const result = optimizeV4(
      [weapon],
      gearNoModEnough,
      modeCtx({ roleKey: "dps_krit" }),
    );
    expect(result.best).not.toBeNull();
    expect(result.best!.admissible).toBe(true);
  }, 30000);

  it("Mod-Maxwerte sind als Annahme in mod.json hinterlegt (mods_v2)", () => {
    const mods = modsJson as unknown as {
      version: string;
      gear_mods: Record<string, Array<{ attr: string; val: number }>>;
    };
    expect(mods.version).toBe("mods_v2");
    const chc = mods.gear_mods.offensive.find((m) => m.attr === "chc");
    expect(chc?.val).toBe(6.0);
    const chd = mods.gear_mods.offensive.find((m) => m.attr === "chd");
    expect(chd?.val).toBe(12.0);
    const repair = mods.gear_mods.utility.find((m) => m.attr === "repair");
    expect(repair?.val).toBe(20.0);
    const pfe = mods.gear_mods.defensive.find((m) => m.attr === "pfe");
    expect(pfe?.val).toBe(13.0);
  });
});
