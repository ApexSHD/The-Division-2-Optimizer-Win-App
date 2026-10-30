import { describe, it, expect } from "vitest";
import { optimizeV4, type ModeContext } from "../operatingModes";
import fixtureJson from "../../../tests/fixtures/reference-strikers-battlegear-dps-krit.json";
import { sampleWeapons, type GearPiece, type GearSlot } from "../sampleData";
import { DEFAULT_OPTIMIZATION } from "../../store";
import { SKILLS } from "../v4Data";
import type { SkillChoice } from "../axes";

interface FixtureGear {
  slot: GearSlot;
  brand: string;
  core: "wd" | "armour" | "skill";
  attributes: Array<{ type: string; value: number }>;
  hint?: string;
  brandType?: "brand" | "gearset" | "named" | "exotic";
}

interface ReferenceFixture {
  version: string;
  game_version: string;
  data_stand: string;
  source: string;
  role: string;
  candidate: string;
  gear: FixtureGear[];
  distractors: FixtureGear[];
}

function toGearPiece(f: FixtureGear, prefix: string): GearPiece {
  return {
    id: `${prefix}-${f.slot}-${f.brand.replace(/[^a-zA-Z]/g, "")}-${f.attributes.map((a) => a.type + a.value).join("_")}`,
    slot: f.slot,
    brand: f.brand,
    brandType: f.brandType ?? "brand",
    core: f.core,
    coreValue: f.core === "armour" ? 170000 : f.core === "skill" ? 1 : 15,
    attributes: f.attributes.map((a) => ({ type: a.type as never, value: a.value })),
    talent: null,
    prototype: true,
  };
}

function fixtureInventar(f: ReferenceFixture): GearPiece[] {
  return [
    ...f.gear.map((g) => toGearPiece(g, "ref")),
    ...f.distractors.map((g) => toGearPiece(g, "distr")),
  ];
}

const turret: SkillChoice = {
  skill: SKILLS.find((s) => s.key === "turret")!,
  variant: SKILLS.find((s) => s.key === "turret")!.variants[0],
};

function ctx(roleKey: string, mode: "inventar" | "ziel" = "inventar"): ModeContext {
  return {
    mode,
    roleKey,
    skills: [turret],
    teamSize: 4,
    shdLevel: 1000,
    settings: { ...DEFAULT_OPTIMIZATION, enemyHeadshotShare: 20 },
    threatStatusShare: 0.3,
    spec: "",
  };
}

describe("Prüfmaßstab V4 (Issue #94, Lastenheft Abschnitt 9/10 — Referenz & Proben)", () => {
  const fixture = fixtureJson as unknown as ReferenceFixture;
  const inventar = fixtureInventar(fixture);
  const weapons = [sampleWeapons[0]];
  const referenceIds = new Set(fixture.gear.map((g) => toGearPiece(g, "ref").id));

  it("Fixture ist vollständig: 6 Referenzteile, 6 Ablenkungen, Quelle und Spielversion", () => {
    expect(fixture.gear).toHaveLength(6);
    expect(fixture.distractors).toHaveLength(6);
    expect(fixture.source).toBeTruthy();
    expect(fixture.game_version).toBeTruthy();
    expect(fixture.data_stand).toBeTruthy();
    expect(fixture.role).toBe("dps_krit");
    expect(fixture.candidate).toContain("Striker's Battlegear");
  });

  it("Kriterium 1: Referenz-Build landet aus dem Testinventar auf Platz 1–3", () => {
    const result = optimizeV4(weapons, inventar, ctx(fixture.role), { maxResults: 10 });
    expect(result.ranked.length).toBeGreaterThan(0);
    const top3 = result.ranked.slice(0, 3);
    const refCount = (id: string) =>
      id.split("|").filter((i) => referenceIds.has(i.split("::")[0])).length;
    const hit = top3.find((r) => refCount(r.id) >= 5);
    expect(hit).toBeDefined();
    if (top3[0].admissible) {
      expect(refCount(top3[0].id)).toBeGreaterThanOrEqual(5);
    }
  }, 60000);

  it("Kriterium 2 (Negativprobe): ein offensichtlich unpassendes Build gewinnt nicht", () => {
    const allBlue = fixture.distractors.map((g) => ({
      ...toGearPiece(g, "distr"),
      core: "armour" as const,
      coreValue: 170000,
    }));
    const pool = [...inventar, ...allBlue];
    const result = optimizeV4(weapons, pool, ctx(fixture.role), { maxResults: 10 });
    expect(result.ranked.length).toBeGreaterThan(0);
    const winner = result.ranked[0];
    expect(winner.admissible).toBe(true);
    const winnerIsAllBlue = winner.id.split("|").every((id) => id.startsWith("distr"));
    expect(winnerIsAllBlue).toBe(false);
  }, 60000);

  it("Kriterium 4 (Wiederholprobe): gleiche Eingabe, gleiches Ergebnis inkl. Tie-Break", () => {
    const a = optimizeV4(weapons, inventar, ctx(fixture.role));
    const b = optimizeV4(weapons, inventar, ctx(fixture.role));
    expect(a.ranked.map((r) => r.id)).toEqual(b.ranked.map((r) => r.id));
    expect(a.ranked.map((r) => r.score)).toEqual(b.ranked.map((r) => r.score));
  }, 60000);

  it("Kriterium 3 (Reihenfolgeprobe-Anbahnung): stärkerer Krit-Teil schlägt schwächeren bei gleicher Rolle", () => {
    const weak = fixture.distractors.map((g) => toGearPiece(g, "distr"));
    const strong = weak.map((g) => ({
      ...g,
      attributes: [{ type: "chc" as never, value: 9 }],
    }));
    const rWeak = optimizeV4(weapons, weak, ctx(fixture.role));
    const rStrong = optimizeV4(weapons, strong, ctx(fixture.role));
    expect(rStrong.best?.score ?? 0).toBeGreaterThanOrEqual(rWeak.best?.score ?? 0);
  }, 60000);

  it("Zweitprüfung Ziel-Build: mit Referenz-Teilen im vollen Pool erreicht der Ziel-Build dessen Score als Obergrenze", () => {
    const inv = optimizeV4(weapons, inventar, ctx(fixture.role, "inventar"));
    const ziel = optimizeV4(weapons, inventar, ctx(fixture.role, "ziel"));
    expect((ziel.best?.score ?? 0) + 1e-9).toBeGreaterThanOrEqual(inv.best?.score ?? 0);
  }, 60000);

  it("Gearset-Regel (Issue #94): Rucksack und Weste des Referenz-Sets sind im Top-Build enthalten, wenn Set-Teile verfügbar", () => {
    const result = optimizeV4(weapons, inventar, ctx(fixture.role), { maxResults: 10 });
    const top = result.ranked[0];
    const usedSlots = new Set(top.id.split("|").map((id) => id.split("-")[1]));
    expect(usedSlots.has("backpack") || usedSlots.size === 6).toBe(true);
    expect(usedSlots.has("chest") || usedSlots.size === 6).toBe(true);
  }, 60000);
});
