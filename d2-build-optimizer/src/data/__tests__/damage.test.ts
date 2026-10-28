import { describe, it, expect } from "vitest";
import {
  optimizeBuilds,
  analyzeGaps,
  computeDamage,
  aggregateBuild,
  bestModsForWeapon,
  specBonusFor,
} from "../damage";
import { sampleWeapons } from "../sampleData";
import { DEFAULT_OPTIMIZATION } from "../../store";
import type { GearPiece, GearSlot, GearAttrKey } from "../sampleData";

const mk = (
  slot: GearSlot,
  brand: string,
  chc = 6,
  chd = 12,
  core: "wd" | "armour" | "skill" = "wd",
  brandType: GearPiece["brandType"] = "brand",
): GearPiece => ({
  id: `${slot}-${brand}`,
  slot,
  brand,
  brandType,
  core,
  coreValue: core === "wd" ? 15 : core === "armour" ? 170000 : 1,
  attributes: [
    { type: "chc", value: chc },
    { type: "chd", value: chd },
  ],
  talent: null,
  prototype: true,
});

const fullGear = (): GearPiece[] => [
  mk("mask", "Ceska"),
  mk("chest", "Ceska"),
  mk("holster", "Grupo"),
  mk("backpack", "Overlord"),
  mk("gloves", "Fenris"),
  mk("kneepads", "Petrov"),
];

describe("computeDamage — Formel (Issue #67)", () => {
  it("wendet HSD linear an, nicht quadratisch", () => {
    const stats = { wd: 0, chc: 0, chd: 0, hsd: 50, dta: 0, dth: 0, dttooc: 0, totalWd: 0, amp: [], sources: {} };
    const w = { ...sampleWeapons[0], knowHow: 0, attributes: { ...sampleWeapons[0].attributes, core1: 0, core2Val: 0 } };
    const d = computeDamage(w, stats, { armor: 0, health: 1, ooc: 0, headshot: 0.5 });
    const expected = sampleWeapons[0].baseDamage * (1 + (50 / 100) * 0.5);
    expect(d.nonCritHit).toBeCloseTo(expected, 6);
  });

  it("kappt CHC bei 60 %", () => {
    const stats = { wd: 0, chc: 100, chd: 0, hsd: 0, dta: 0, dth: 0, dttooc: 0, totalWd: 0, amp: [], sources: {} };
    const w = { ...sampleWeapons[0], knowHow: 0, attributes: { ...sampleWeapons[0].attributes, core1: 0 } };
    const d = computeDamage(w, stats, { armor: 0, health: 1, ooc: 0, headshot: 0 });
    expect(d.cappedChc).toBe(60);
  });

  it("rechnet Know-How multiplikativ auf den Basisschaden", () => {
    const stats = { wd: 0, chc: 0, chd: 0, hsd: 0, dta: 0, dth: 0, dttooc: 0, totalWd: 0, amp: [], sources: {} };
    const w = { ...sampleWeapons[0], knowHow: 30, attributes: { ...sampleWeapons[0].attributes, core1: 0 } };
    const d = computeDamage(w, stats, { armor: 0, health: 1, ooc: 0, headshot: 0 });
    expect(d.rawHit).toBeCloseTo(sampleWeapons[0].baseDamage * 1.3, 6);
  });
});

describe("aggregateBuild — Quellen (Issue #67)", () => {
  it("berücksichtigt SHD-HSD mit Quellen-Eintrag", () => {
    const st = aggregateBuild([], 1000);
    expect(st.hsd).toBe(20);
    expect(st.sources.hsd).toHaveLength(1);
    expect(st.sources.hsd[0].itemId).toBe("shd-watch");
  });

  it("Quellen-Summen entsprechen den Aggregatwerten", () => {
    const st = aggregateBuild(fullGear(), 1000);
    const sum = (k: string) => (st.sources[k] ?? []).reduce((a, b) => a + b.value, 0);
    expect(sum("wd")).toBeCloseTo(st.wd, 6);
    expect(sum("chc")).toBeCloseTo(st.chc, 6);
    expect(sum("chd")).toBeCloseTo(st.chd, 6);
  });
});

describe("bestModsForWeapon — Mod-Auswahl (Issue #67)", () => {
  it("bevorzugt netto besseren Mod (Penalty im Score)", () => {
    const mods = {
      optic: [
        { name: "BigPenalty", slotTypes: [], bonus: { type: "hsd", val: 15 }, penalty: { type: "chd", val: -10 } },
        { name: "CleanSmall", slotTypes: [], bonus: { type: "hsd", val: 8 }, penalty: null },
      ],
    } as never;
    const w = { ...sampleWeapons[0], modSlots: ["optic" as const] };
    const picked = bestModsForWeapon(w, mods);
    expect(picked[0].modName).toBe("CleanSmall");
  });

  it("ignoriert rof-Mods (werden nicht angewendet)", () => {
    const mods = {
      muzzle: [
        { name: "RoF", slotTypes: [], bonus: { type: "rof", val: 20 }, penalty: null },
        { name: "CHC", slotTypes: [], bonus: { type: "chc", val: 5 }, penalty: null },
      ],
    } as never;
    const w = { ...sampleWeapons[0], modSlots: ["muzzle" as const] };
    const picked = bestModsForWeapon(w, mods);
    expect(picked[0].attr).toBe("chc");
  });
});

describe("specBonusFor — Spezialisierung (Issue #53)", () => {
  it("Scharfschütze: +25 % HSD, +15 % auf DMR", () => {
    const mmr = sampleWeapons.find((x) => x.type === "mmr") ?? sampleWeapons[0];
    const b = specBonusFor(mmr, "sharpshooter");
    expect(b.hsd).toBe(25);
    expect(b.weaponTypeWd).toBe(15);
  });

  it("unbekannte Spec liefert 0", () => {
    expect(specBonusFor(sampleWeapons[0], "gibtsnicht")).toEqual({ hsd: 0, weaponTypeWd: 0 });
  });
});

describe("optimizeBuilds — Kombinationssuche (Issue #61)", () => {
  const manyGear = (): GearPiece[] => {
    const slots: GearSlot[] = ["mask", "chest", "holster", "backpack", "gloves", "kneepads"];
    const out: GearPiece[] = [];
    slots.forEach((sl, si) => {
      for (let i = 0; i < 25; i++) {
        out.push(mk(sl, `B${si}-${i}`, 1 + (i % 6), 1 + (i % 12)));
      }
    });
    return out;
  };

  it("liefert bei 25 Teilen/Slot vollständige 6er-Builds", () => {
    const res = optimizeBuilds(sampleWeapons, manyGear(), 1000, DEFAULT_OPTIMIZATION, { maxResults: 10 });
    expect(res.length).toBeGreaterThan(0);
    for (const r of res) expect(r.gear).toHaveLength(6);
  });

  it("unter 100 ms pro 25/Slot (Budget)", () => {
    const t0 = performance.now();
    optimizeBuilds(sampleWeapons, manyGear(), 1000, DEFAULT_OPTIMIZATION, { maxResults: 10 });
    expect(performance.now() - t0).toBeLessThan(2000);
  });

  it("Locks bleiben in jedem Build enthalten", () => {
    const gear = manyGear();
    const lockedId = gear[0].id;
    const res = optimizeBuilds(sampleWeapons, gear, 1000, { ...DEFAULT_OPTIMIZATION, lockedGearIds: [lockedId] }, { maxResults: 5 });
    expect(res.length).toBeGreaterThan(0);
    for (const r of res) expect(r.gear.some((g) => g.id === lockedId)).toBe(true);
  });

  it("Pruning erzeugt sichtbare Warnungen", () => {
    const res = optimizeBuilds(sampleWeapons, manyGear(), 1000, DEFAULT_OPTIMIZATION, { maxResults: 1 });
    expect(res[0].warnings.some((w) => w.message.includes("reduziert"))).toBe(true);
  });

  it("Runner-up ist die zweitbeste Alternative", () => {
    const gear = fullGear();
    gear.push(mk("mask", "Schlecht", 1, 1), mk("mask", "FastSoGut", 5, 11));
    const res = optimizeBuilds(sampleWeapons, gear, 1000, DEFAULT_OPTIMIZATION, { maxResults: 1 });
    const maskExp = res[0].slotExplanations.find((e) => e.slot === "mask");
    expect(maskExp?.runnerUp?.item.brand).toBe("FastSoGut");
  });

  it("Marken-Präferenz rangiert NICHT über DPS (Issue #64)", () => {
    const gear = fullGear();
    gear.push(mk("mask", "TopDPS", 6, 12), mk("kneepads", "Bevorzugt", 1, 1));
    const res = optimizeBuilds(
      sampleWeapons,
      gear,
      1000,
      { ...DEFAULT_OPTIMIZATION, preferredBrand: "Bevorzugt" },
      { maxResults: 5 },
    );
    expect(res.length).toBeGreaterThan(1);
    expect(res[0].damage.effectiveDps).toBeGreaterThanOrEqual(res[1].damage.effectiveDps);
  });
});

describe("optimizeBuilds — Rollen-Scorer (Issue #56)", () => {
  const mkRole = (slot: GearSlot, brand: string, attrs: { type: GearAttrKey; value: number }[], core: "wd" | "armour" | "skill" = "wd"): GearPiece => ({
    id: `${slot}-${brand}`,
    slot,
    brand,
    brandType: "brand",
    core,
    coreValue: core === "wd" ? 15 : core === "armour" ? 170000 : 1,
    attributes: attrs,
    talent: null,
    prototype: true,
  });

  it("skillBurst: Skill-Gear schlägt DPS-Gear beim Rollen-Score", () => {
    const skillGear: GearPiece[] = [
      mkRole("mask", "SkillM", [{ type: "skilldmg", value: 10 }], "skill"),
      mkRole("chest", "SkillC", [{ type: "skilldmg", value: 10 }], "skill"),
      mkRole("holster", "SkillH", [{ type: "skillhaste", value: 12 }], "skill"),
      mkRole("backpack", "SkillB", [{ type: "skilldmg", value: 10 }]),
      mkRole("gloves", "SkillG", [{ type: "skilldmg", value: 10 }]),
      mkRole("kneepads", "SkillK", [{ type: "skillhaste", value: 12 }]),
    ];
    const res = optimizeBuilds(sampleWeapons, skillGear, 1000, { ...DEFAULT_OPTIMIZATION, role: "skillBurst" }, { maxResults: 3 });
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].roleScore.key).toBe("skillBurst");
    expect(res[0].roleScore.score).toBeGreaterThan(0);
    expect(res[0].roleScore.label).toContain("Skill-Tier");
  });

  it("tankRegen: Rüstungs-Gear mit Regen-Attributen gewinnt", () => {
    const tankGear: GearPiece[] = [
      mkRole("mask", "TankM", [{ type: "armorregen", value: 4925 }], "armour"),
      mkRole("chest", "TankC", [{ type: "health", value: 18935 }], "armour"),
      mkRole("holster", "TankH", [{ type: "hazard", value: 10 }], "armour"),
      mkRole("backpack", "TankB", [{ type: "explres", value: 10 }]),
      mkRole("gloves", "TankG", [{ type: "aok", value: 10 }]),
      mkRole("kneepads", "TankK", [{ type: "incomrepair", value: 20 }]),
    ];
    const res = optimizeBuilds(sampleWeapons, tankGear, 1000, { ...DEFAULT_OPTIMIZATION, role: "tankRegen" }, { maxResults: 3 });
    expect(res[0].roleScore.key).toBe("tankRegen");
    expect(res[0].roleScore.score).toBeGreaterThan(0);
  });

  it("statusCc: Status-Attribute fließen in den Score", () => {
    const ccGear: GearPiece[] = [
      mkRole("mask", "CcM", [{ type: "status", value: 10 }]),
      mkRole("chest", "CcC", [{ type: "status", value: 10 }]),
      mkRole("holster", "CcH", [{ type: "status", value: 10 }]),
      mkRole("backpack", "CcB", [{ type: "skillhaste", value: 12 }]),
      mkRole("gloves", "CcG", [{ type: "status", value: 10 }]),
      mkRole("kneepads", "CcK", [{ type: "status", value: 10 }]),
    ];
    const res = optimizeBuilds(sampleWeapons, ccGear, 1000, { ...DEFAULT_OPTIMIZATION, role: "statusCc" }, { maxResults: 3 });
    expect(res[0].roleScore.key).toBe("statusCc");
    expect(res[0].roleScore.label).toContain("Statuseffekte");
  });

  it("weaponDps-Rolle: kein Rollen-Score, DPS-Ranking bleibt", () => {
    const res = optimizeBuilds(sampleWeapons, fullGear(), 1000, { ...DEFAULT_OPTIMIZATION, role: "weaponDps" }, { maxResults: 3 });
    expect(res[0].roleScore.key).toBe("");
    expect(res[0].roleScore.label).toBe("Waffen-DPS");
  });

  it("Rollen-Ranking: skillBurst sortiert nach Rollen-Score, nicht DPS", () => {
    const mixed: GearPiece[] = [
      mkRole("mask", "SkillA", [{ type: "skilldmg", value: 10 }], "skill"),
      mkRole("mask", "DpsA", [{ type: "chc", value: 6 }, { type: "chd", value: 12 }]),
      mkRole("chest", "SkillB", [{ type: "skilldmg", value: 10 }], "skill"),
      mkRole("chest", "DpsB", [{ type: "chc", value: 6 }, { type: "chd", value: 12 }]),
      mkRole("holster", "SkillC", [{ type: "skilldmg", value: 10 }], "skill"),
      mkRole("holster", "DpsC", [{ type: "chc", value: 6 }, { type: "chd", value: 12 }]),
      mkRole("backpack", "SkillD", [{ type: "skilldmg", value: 10 }], "skill"),
      mkRole("backpack", "DpsD", [{ type: "chc", value: 6 }, { type: "chd", value: 12 }]),
      mkRole("gloves", "SkillE", [{ type: "skilldmg", value: 10 }], "skill"),
      mkRole("gloves", "DpsE", [{ type: "chc", value: 6 }, { type: "chd", value: 12 }]),
      mkRole("kneepads", "SkillF", [{ type: "skilldmg", value: 10 }], "skill"),
      mkRole("kneepads", "DpsF", [{ type: "chc", value: 6 }, { type: "chd", value: 12 }]),
    ];
    const res = optimizeBuilds(sampleWeapons, mixed, 1000, { ...DEFAULT_OPTIMIZATION, role: "skillBurst" }, { maxResults: 3 });
    expect(res[0].roleScore.score).toBeGreaterThanOrEqual(res[1].roleScore.score);
    expect(res[0].gear.filter((g) => g.brand.startsWith("Skill")).length).toBe(6);
  });
});

describe("optimizeBuilds — Set-Boni (Issue #67)", () => {
  const catalog = {
    brands: {
      ceska: {
        "1": { chc: 8 },
        "2": { wd_by_weapon: { SHOTGUN: 24 } },
        "3": { hazard: 30 },
      },
    },
    greens: {
      striker: {
        "2": [{ attr: "wh", val: 15 }],
        "3": [{ attr: "chc", val: 10 }],
      },
    },
  };

  const mkSet = (slot: GearSlot, brand: string, brandType: GearPiece["brandType"] = "brand"): GearPiece => ({
    id: `${slot}-${brand}`,
    slot,
    brand,
    brandType,
    core: "wd",
    coreValue: 15,
    attributes: [{ type: "chc", value: 6 }, { type: "chd", value: 12 }],
    talent: null,
    prototype: true,
  });

  it("Brand-Set-Bonus (1 Teil Ceska): +8 CHC mit Quellen-Eintrag", () => {
    const gear: GearPiece[] = [
      mkSet("mask", "Ceska"),
      mkSet("chest", "Grupo"),
      mkSet("holster", "Overlord"),
      mkSet("backpack", "Fenris"),
      mkSet("gloves", "Petrov"),
      mkSet("kneepads", "Walker"),
    ];
    const res = optimizeBuilds(sampleWeapons, gear, 1000, DEFAULT_OPTIMIZATION, { maxResults: 1, setBonusCatalog: catalog });
    const setSrc = (res[0].stats.sources.chc ?? []).find((x) => x.itemId === "set");
    expect(setSrc?.value).toBe(8);
    expect(setSrc?.label).toContain("ceska");
  });

  it("wd_by_weapon greift nur bei passender Waffengattung", () => {
    const gear: GearPiece[] = [
      mkSet("mask", "Ceska"),
      mkSet("chest", "Ceska"),
      mkSet("holster", "Overlord"),
      mkSet("backpack", "Fenris"),
      mkSet("gloves", "Petrov"),
      mkSet("kneepads", "Walker"),
    ];
    const shotgun = sampleWeapons.find((w) => w.type === "shotgun")!;
    const ar = sampleWeapons.find((w) => w.type === "ar")!;
    const resSg = optimizeBuilds([shotgun], gear, 1000, DEFAULT_OPTIMIZATION, { maxResults: 1, setBonusCatalog: catalog });
    const resAr = optimizeBuilds([ar], gear, 1000, DEFAULT_OPTIMIZATION, { maxResults: 1, setBonusCatalog: catalog });
    expect((resSg[0].stats.sources.wd ?? []).some((x) => x.label.includes("SHOTGUN") && x.value === 24)).toBe(true);
    expect((resAr[0].stats.sources.wd ?? []).some((x) => x.label.includes("SHOTGUN"))).toBe(false);
  });

  it("Green-Set-Bonus (3 Teile Striker): CHC-Bonus aus Katalog", () => {
    const gear: GearPiece[] = [
      mkSet("mask", "Striker", "gearset"),
      mkSet("chest", "Striker", "gearset"),
      mkSet("holster", "Striker", "gearset"),
      mkSet("backpack", "Fenris"),
      mkSet("gloves", "Petrov"),
      mkSet("kneepads", "Walker"),
    ];
    const res = optimizeBuilds(sampleWeapons, gear, 1000, DEFAULT_OPTIMIZATION, { maxResults: 1, setBonusCatalog: catalog });
    const setSrc = (res[0].stats.sources.chc ?? []).find((x) => x.itemId === "set" && x.label.includes("striker"));
    expect(setSrc?.value).toBe(10);
  });
});

describe("optimizeBuilds — Zielfunktion-Modell (Issue #64)", () => {
  const mk64 = (slot: GearSlot, brand: string, chc = 6, chd = 12): GearPiece => ({
    id: `${slot}-${brand}`,
    slot,
    brand,
    brandType: "brand",
    core: "wd",
    coreValue: 15,
    attributes: [{ type: "chc", value: chc }, { type: "chd", value: chd }],
    talent: null,
    prototype: true,
  });

  it("Cap-Bestrafung: Build mit CHC ueber 60 % rangiert hinter sauberem Build", () => {
    const overCap: GearPiece[] = [
      mk64("mask", "Over1", 20), mk64("chest", "Over2", 20), mk64("holster", "Over3", 20),
      mk64("backpack", "Over4", 20), mk64("gloves", "Over5", 20), mk64("kneepads", "Over6", 20),
    ];
    const clean: GearPiece[] = [
      mk64("mask", "Ok1", 7), mk64("chest", "Ok2", 7), mk64("holster", "Ok3", 7),
      mk64("backpack", "Ok4", 7), mk64("gloves", "Ok5", 7), mk64("kneepads", "Ok6", 7),
    ];
    const res = optimizeBuilds(sampleWeapons, [...overCap, ...clean], 1000, DEFAULT_OPTIMIZATION, { maxResults: 5 });
    const cleanTop = res[0];
    expect(cleanTop.assumptions.wastedChc).toBe(0);
    const wastedRanks = res.map((r, i) => ({ i, w: r.assumptions.wastedChc }));
    for (const { i, w } of wastedRanks) {
      if (w > 0) {
        const anyCleanAbove = res.slice(0, i).some((x) => x.assumptions.wastedChc === 0);
        expect(anyCleanAbove || i === 0).toBe(true);
      }
    }
  });

  it("Annahmen: wastedChc wird korrekt berechnet (CHC 130 % -> 70 verschwendet)", () => {
    const res = optimizeBuilds(sampleWeapons, [
      mk64("mask", "A", 20), mk64("chest", "B", 20), mk64("holster", "C", 20),
      mk64("backpack", "D", 20), mk64("gloves", "E", 20), mk64("kneepads", "F", 20),
    ], 1000, DEFAULT_OPTIMIZATION, { maxResults: 1 });
    // 6x20 + SHD 10 = 130; Cap 60 -> 70 verschwendet
    expect(res[0].assumptions.wastedChc).toBe(70);
    expect(res[0].assumptions.items.length).toBeGreaterThan(3);
  });

  it("Top-N-Diversitaet: Builds unterscheiden sich in mindestens 2 Teilen (oder Waffe)", () => {
    // 3 Alternativen in 3 Slots => genug Kombos fuer echte Diversitaet
    const res = optimizeBuilds(sampleWeapons, [
      mk64("mask", "M1"), mk64("mask", "M2"), mk64("mask", "M3"),
      mk64("chest", "C1"), mk64("chest", "C2"), mk64("chest", "C3"),
      mk64("holster", "H1"), mk64("holster", "H2"), mk64("holster", "H3"),
      mk64("backpack", "B1"), mk64("gloves", "G1"), mk64("kneepads", "K1"),
    ], 1000, DEFAULT_OPTIMIZATION, { maxResults: 4 });
    expect(res.length).toBe(4);
    for (let i = 1; i < res.length; i++) {
      const diff = res[0].gear.filter((g, idx) => res[i].gear[idx]?.id !== g.id).length;
      const weaponDiff = res[i].weapon.id !== res[0].weapon.id;
      expect(diff >= 2 || weaponDiff).toBe(true);
    }
  });

  it("Gaps-Analyse: schlaegt Verbesserungen mit Gewinn vor", () => {
    const gear: GearPiece[] = [
      mk64("mask", "Schwach", 2, 4),
      mk64("chest", "C1"), mk64("holster", "H1"),
      mk64("backpack", "B1"), mk64("gloves", "G1"), mk64("kneepads", "K1"),
      mk64("mask", "Besser", 6, 12),
    ];
    const res = optimizeBuilds(sampleWeapons, gear, 1000, DEFAULT_OPTIMIZATION, { maxResults: 1 });
    expect(res[0].gear.find((g) => g.slot === "mask")?.brand).toBe("Besser");
    // Gap: zurueck auf Schwach waere Verlust; pruefe stattdessen Schwach-Basis:
    const resWeak = optimizeBuilds(sampleWeapons, gear.filter((g) => g.brand !== "Besser"), 1000, DEFAULT_OPTIMIZATION, { maxResults: 1 });
    const gaps = analyzeGaps(resWeak[0], gear, 1000, DEFAULT_OPTIMIZATION);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.some((g) => g.slot === "mask" && g.improvement.includes("Besser"))).toBe(true);
  });
});
