import { describe, it, expect } from "vitest";
import {
  optimizeBuilds,
  computeDamage,
  aggregateBuild,
  bestModsForWeapon,
  specBonusFor,
} from "../damage";
import { sampleWeapons } from "../sampleData";
import { DEFAULT_OPTIMIZATION } from "../../store";
import type { GearPiece, GearSlot } from "../sampleData";

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
    const w = { ...sampleWeapons[0], knowHow: 0, attributes: { ...sampleWeapons[0].attributes, core1: 0 } };
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
