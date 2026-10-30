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
import { GEAR_TALENTS } from "../v4Data";
import modsJson from "../../db/mod.json";
import gearJson from "../../db/gear.json";
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
  brand = "Testmarke",
): GearPiece {
  return {
    id: id ?? `${slot}-${core}-${Math.random().toString(36).slice(2, 7)}`,
    slot,
    brand,
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

describe("Gearset-4p-Boni (Striker, Zünglein, Zorn des Jägers)", () => {
  it("alle drei DPS-Gearsets haben ein 4p-Tier in green_set_info (Annahme-markiert)", () => {
    const gearDb = gearJson as unknown as {
      green_set_info: Record<
        string,
        { bonuses: Record<string, Array<{ attr: string; val: number; value_status?: string }>> }
      >;
    };
    for (const key of ["striker", "tippingscales", "huntersfury"]) {
      const tiers = gearDb.green_set_info[key].bonuses;
      expect(tiers["4"]).toBeDefined();
      expect(tiers["4"].length).toBeGreaterThan(0);
      expect(tiers["4"][0].value_status).toContain("Annahme");
    }
    expect(gearDb.green_set_info.striker.bonuses["4"][0]).toMatchObject({ attr: "wd", val: 65 });
    expect(gearDb.green_set_info.striker.bonuses["4"][0].value_status).toContain("Maximalschaden");
    expect(gearDb.green_set_info.tippingscales.bonuses["4"][0]).toMatchObject({ attr: "chd", val: 100 });
    expect(gearDb.green_set_info.huntersfury.bonuses["4"][0]).toMatchObject({ attr: "wd", val: 20 });
  });

  it("4p-Tier wirkt in der Set-Bonus-Anwendung: 4er-Zünglein schlägt 3er-Variante", () => {
    const ts = (slot: GearSlot, id: string): GearPiece =>
      gear(slot, "wd", [{ type: "chc", value: 9 }], id, "Tipping Scales");
    const mkSet = (slots: GearSlot[], prefix: string): GearPiece[] =>
      slots.map((s, i) => ({ ...ts(s, `${prefix}-${i}`), brandType: "gearset" as const }));
    const fourSet = mkSet(["mask", "chest", "holster", "backpack"], "ts4");
    const threeSet = mkSet(["mask", "chest", "holster"], "ts3");
    const fillAll = (["mask", "chest", "holster", "backpack", "gloves", "kneepads"] as GearSlot[]).map((s, i) =>
      gear(s, "wd", [{ type: "chc", value: 9 }], `fill-${i}`),
    );
    const ctxDps = modeCtx({ roleKey: "dps_krit" });
    const resultFour = optimizeV4([weapon], [...fourSet, ...fillAll], ctxDps, {
      maxResults: 5,
    });
    const resultThree = optimizeV4([weapon], [...threeSet, ...fillAll], ctxDps, {
      maxResults: 5,
    });
    expect(resultFour.ranked.length).toBeGreaterThan(0);
    expect(resultThree.ranked.length).toBeGreaterThan(0);
    const bestDpsFour = Math.max(...resultFour.ranked.map((r) => r.vector.dps));
    const bestDpsThree = Math.max(...resultThree.ranked.map((r) => r.vector.dps));
    expect(bestDpsFour).toBeGreaterThan(bestDpsThree);
  }, 30000);
});

describe("Spieler-Optionen: Gearset-Regel, Waffengattung, BUF-Werte (Klärung 29.11.)", () => {
  const strikerSet = (slots: GearSlot[], prefix: string): GearPiece[] =>
    slots.map((s, i) => ({
      ...gear(s, "wd", [{ type: "chc", value: 9 }], `${prefix}-${i}`, "Striker's Battlegear"),
      brandType: "gearset" as const,
    }));
  const fill = (): GearPiece[] =>
    (["mask", "chest", "holster", "backpack", "gloves", "kneepads"] as GearSlot[]).map((s, i) =>
      gear(s, "wd", [{ type: "chc", value: 9 }], `fill-${i}`),
    );

  it("Gearset-Regel erzwingt: 4 Set-Teile, davon Set-Weste und Set-Rucksack (Standard: beide an)", () => {
    const pool = [...strikerSet(["mask", "chest", "holster", "backpack"], "st"), ...fill()];
    const result = optimizeV4(
      [weapon],
      pool,
      modeCtx({
        roleKey: "dps_krit",
        gearSetOptions: { targetSet: "Striker's Battlegear", requireSetChest: true, requireSetBackpack: true },
      } as never),
    );
    expect(result.best).not.toBeNull();
    const bestGear = result.candidates.find((c) => c.id === result.best!.id)?.gear ?? [];
    const setPieces = bestGear.filter((g) => g.brand === "Striker's Battlegear");
    expect(setPieces.length).toBeGreaterThanOrEqual(4);
    expect(setPieces.some((g) => g.slot === "chest")).toBe(true);
    expect(setPieces.some((g) => g.slot === "backpack")).toBe(true);
  }, 30000);

  it("Gearset-Regel ohne Set im Inventar: kein zulässiges Build mit Hinweis (Kriterium 13)", () => {
    const result = optimizeV4(
      [weapon],
      fill(),
      modeCtx({
        roleKey: "dps_krit",
        gearSetOptions: { targetSet: "Striker's Battlegear" },
      } as never),
    );
    expect(result.noAdmissibleHint).toContain("Gearset-Regel");
  }, 30000);

  it("Erzwingen abschaltbar: ohne Weste-Erzwingung reicht 4er mit Set-Rucksack, aber ohne Set-Weste", () => {
    const pool = [...strikerSet(["mask", "holster", "gloves", "backpack"], "st"), ...fill()];
    const result = optimizeV4(
      [weapon],
      pool,
      modeCtx({
        roleKey: "dps_krit",
        gearSetOptions: { targetSet: "Striker's Battlegear", requireSetChest: false, requireSetBackpack: true },
      } as never),
    );
    expect(result.best).not.toBeNull();
  }, 30000);

  it("Waffengattungs-Filter wirkt bei Schadens-Rollen (AR-Only im Settings)", () => {
    const arWeapon = { ...sampleWeapons[0], type: "ar" as const };
    const lmgWeapon = { ...sampleWeapons[0], id: "w-lmg", name: "Test-LMG", type: "lmg" as const };
    const result = optimizeV4(
      [arWeapon, lmgWeapon],
      fill(),
      modeCtx({
        roleKey: "dps_krit",
        settings: { ...DEFAULT_OPTIMIZATION, enemyHeadshotShare: 20, weaponTypeFilter: "lmg" },
      }),
    );
    expect(result.ranked.length).toBeGreaterThan(0);
    for (const c of result.candidates) {
      expect(c.weapon.type).toBe("lmg");
    }
  }, 30000);

  it("Galvanize und Future Initiative (Ground Control) haben BUF-Werte aus der Klärung", () => {
    const galvanize = GEAR_TALENTS.find((t) => t.key === "galvanize")!;
    expect(galvanize.wert).toBe(40);
    expect(galvanize.team_wirkung).toBe(true);
    const perfect = GEAR_TALENTS.find((t) => t.key === "perfect_galvanize")!;
    expect(perfect.wert).toBe(50);
    const fi = GEAR_TALENTS.find((t) => t.key === "future_initiative_chest")!;
    expect(fi.wert).toBe(15);
    expect(fi.team_wirkung).toBe(true);
  });
});

describe("Adaptive Gear-Mods & erzwungene Waffe", () => {
  const fill = (): GearPiece[] =>
    (["mask", "chest", "holster", "backpack", "gloves", "kneepads"] as GearSlot[]).map((s, i) =>
      gear(s, "wd", [{ type: "chc", value: 9 }], `fill-${i}`),
    );

  it("Adaptive Mods: CHC-Mods, solange Zielwert nicht erreicht — CHD-Mods, wenn CHC schon am Ziel", () => {
    const below = bestGearModsForRole("dps_krit", { chcTarget: 50, chcCurrent: 30 });
    expect(below.every((m) => m.attr === "chc")).toBe(true);
    const atTarget = bestGearModsForRole("dps_krit", { chcTarget: 50, chcCurrent: 55 });
    expect(atTarget.every((m) => m.attr === "chd")).toBe(true);
  });

  it("Erzwungene Waffe: nur diese Waffe in den Ergebnissen (anchorWeaponId)", () => {
    const w1 = { ...sampleWeapons[0], id: "w-forced", name: "Erzwungen" };
    const w2 = { ...sampleWeapons[0], id: "w-other", name: "Andere" };
    const result = optimizeV4(
      [w1, w2],
      fill(),
      modeCtx({
        roleKey: "dps_krit",
        settings: { ...DEFAULT_OPTIMIZATION, enemyHeadshotShare: 20, anchorWeaponId: "w-forced" },
      }),
    );
    expect(result.ranked.length).toBeGreaterThan(0);
    for (const c of result.candidates) {
      expect(c.weapon.id).toBe("w-forced");
    }
  }, 30000);

  it("Waffen-Mods: modsBySlot geht an die Engine (CHC-Mod erhöht den effektiven DPS-Pfad)", () => {
    const modsBySlot = {
      optic: [
        { name: "Test-CHC-Sicht", slotTypes: ["Iron Sights Slot"], bonus: { type: "chc", val: 10 }, penalty: null },
      ],
      muzzle: [],
      magazine: [],
      underbarrel: [],
    };
    const result = optimizeV4(
      [sampleWeapons[0]],
      fill(),
      modeCtx({ roleKey: "dps_krit" }),
      { modsBySlot: modsBySlot as never },
    );
    expect(result.ranked.length).toBeGreaterThan(0);
    const best = result.candidates.find((c) => c.id === result.best!.id);
    expect(best).toBeDefined();
    expect(best!.stats.chc).toBeGreaterThanOrEqual(10);
  }, 30000);
});
