import { describe, it, expect } from "vitest";
import {
  enemyPoolM,
  timeToKillSeconds,
  difficultyInfo,
  ESCALATION_SCALING,
  DIFFICULTIES,
  allowedDifficulties,
  defaultDifficultyFor,
  prototypeCapActive,
  stackSetHint,
  applyPrototypeCapToGear,
  applyPrototypeCapToWeapon,
} from "../difficultyProfiles";
import { normalizeGear, normalizeWeapon } from "../sampleData";

describe("Schwierigkeitsgrade: Vorgabe-Tabelle des Auftraggebers", () => {
  it("Heroic Solo-Pools exakt wie Vorgabe (Rot 3,0 / Veteran 6,0 / Elite 11,0 / Named 27,0 Mio)", () => {
    expect(enemyPoolM("heroic", "red", 1)).toBeCloseTo(3.0, 6);
    expect(enemyPoolM("heroic", "veteran", 1)).toBeCloseTo(6.0, 6);
    expect(enemyPoolM("heroic", "elite", 1)).toBeCloseTo(11.0, 6);
    expect(enemyPoolM("heroic", "named", 1)).toBeCloseTo(27.0, 6);
  });

  it("Normal Solo: Rot 0,55 / Veteran 1,2 / Elite 2,5 / Named 5,57 Mio", () => {
    expect(enemyPoolM("normal", "red", 1)).toBeCloseTo(0.55, 6);
    expect(enemyPoolM("normal", "veteran", 1)).toBeCloseTo(1.2, 6);
    expect(enemyPoolM("normal", "elite", 1)).toBeCloseTo(2.5, 6);
    expect(enemyPoolM("normal", "named", 1)).toBeCloseTo(5.57, 6);
  });

  it("Legend\u00e4r Solo: Rot 5,37 / Elite 25,2 / Named 40,0 Mio", () => {
    expect(enemyPoolM("legendary", "red", 1)).toBeCloseTo(5.37, 6);
    expect(enemyPoolM("legendary", "elite", 1)).toBeCloseTo(25.2, 6);
    expect(enemyPoolM("legendary", "named", 1)).toBeCloseTo(40.0, 6);
  });

  it("Team-Skalierung x1,2 je zusaetzlichem Spieler (Heroic Named: 27 / 32,4 / 38,88 / 46,66)", () => {
    expect(enemyPoolM("heroic", "named", 2)).toBeCloseTo(27.0 * 1.2, 5);
    expect(enemyPoolM("heroic", "named", 3)).toBeCloseTo(27.0 * 1.44, 4);
    expect(enemyPoolM("heroic", "named", 4)).toBeCloseTo(46.66, 1);
  });
});

describe("Eskalationsstufen (Community-Daten, bestaetigt durch Auftraggeber)", () => {
  it("Stufe 10: Schaden +550 %, LE/Ruestung +800 % relativ zu Heroic", () => {
    expect(ESCALATION_SCALING[10]).toEqual({ damage: 5.5, health: 8.0, armor: 8.0 });
  });

  it("Ab Stufe 6 skaliert Ueberleben schneller als Schaden; Schaden gedeckelt bei 550 %", () => {
    expect(ESCALATION_SCALING[9].damage).toBe(5.5);
    expect(ESCALATION_SCALING[10].damage).toBe(5.5);
    expect(ESCALATION_SCALING[6].health).toBeGreaterThan(ESCALATION_SCALING[6].damage);
  });

  it("Eskalation 10 Elite-Pool = Heroic Elite 11 Mio x 8,0 x Teamfaktor", () => {
    expect(enemyPoolM("escalation10", "elite", 1)).toBeCloseTo(11.0 * 8.0, 5);
    expect(enemyPoolM("escalation10", "elite", 4)).toBeCloseTo(11.0 * 8.0 * 1.728, 3);
  });

  it("alle 17 Schwierigkeiten verfuegbar und gelabelt", () => {
    expect(DIFFICULTIES.length).toBe(17);
    expect(difficultyInfo("escalation5").label).toContain("5");
  });
});

describe("Zeit zum Toeten (TTK)", () => {
  it("TTK = Pool / DPS; Heroic Elite Solo bei 1 Mio DPS = 11 s", () => {
    expect(timeToKillSeconds("heroic", "elite", 1, 1_000_000)).toBeCloseTo(11, 6);
  });

  it("TTK steigt mit Schwierigkeit, Teamgroesse und Eskalationsstufe", () => {
    const solo = timeToKillSeconds("heroic", "elite", 1, 1_000_000)!;
    const four = timeToKillSeconds("heroic", "elite", 4, 1_000_000)!;
    const esc = timeToKillSeconds("escalation10", "elite", 4, 1_000_000)!;
    expect(four).toBeGreaterThan(solo);
    expect(esc).toBeGreaterThan(four);
  });

  it("DPS 0 -> kein TTK (null)", () => {
    expect(timeToKillSeconds("heroic", "elite", 1, 0)).toBeNull();
  });
});

describe("Spielmodus-Abhaengigkeiten (Auftraggeber, korrigierte Tabelle)", () => {
  it("Offene Welt/Vergeltung: Heroisch, Herausfordernd, Schwer, Normal (kein Story)", () => {
    expect(allowedDifficulties("openworld")).toEqual(["heroic", "challenging", "hard", "normal"]);
    expect(allowedDifficulties("countdown")).toEqual(["heroic", "challenging", "hard", "normal"]);
    expect(allowedDifficulties("openworld")).not.toContain("story");
  });

  it("Missionen: Eskalation 10-0 gefolgt von Legendaer bis Story", () => {
    const missions = allowedDifficulties("missions");
    expect(missions[0]).toBe("escalation10");
    expect(missions[10]).toBe("escalation0");
    expect(missions).toContain("legendary");
    expect(missions).toContain("story");
    expect(missions.length).toBe(17);
  });

  it("Raid: Normal und Story; Incursion: nur Normal; PvP: leer (Konzept spaeter)", () => {
    expect(allowedDifficulties("raid")).toEqual(["normal", "story"]);
    expect(allowedDifficulties("incursion")).toEqual(["normal"]);
    expect(allowedDifficulties("pvp")).toEqual([]);
  });

  it("Vorbelegung: Raid/Incursion -> Normal, sonst Heroisch", () => {
    expect(defaultDifficultyFor("raid")).toBe("normal");
    expect(defaultDifficultyFor("incursion")).toBe("normal");
    expect(defaultDifficultyFor("openworld")).toBe("heroic");
    expect(defaultDifficultyFor(undefined)).toBe("heroic");
  });

  it("Prototyp-Deckelung nur bei Raid/Incursion aktiv", () => {
    expect(prototypeCapActive("raid")).toBe(true);
    expect(prototypeCapActive("incursion")).toBe(true);
    expect(prototypeCapActive("missions")).toBe(false);
    expect(prototypeCapActive(undefined)).toBe(false);
  });

  it("Stack-Hinweis: kurze Kaempfe bei Schwer, volle Stacks ab Heroisch/Eskalation", () => {
    expect(stackSetHint("hard", ["Striker"])).toContain("kaum auf");
    expect(stackSetHint("challenging", ["Striker"])).toContain("Westen-/Rucksack-Talent");
    expect(stackSetHint("heroic", ["Striker"])).toContain("wirken voll");
    expect(stackSetHint("escalation8", ["Striker", "Heartbreaker"])).toContain("wirken voll");
    expect(stackSetHint("heroic", [])).toBeNull();
  });
});

describe("Rechnerische Prototyp-Deckelung (Raid/Incursion)", () => {
  const mkProtoGear = () =>
    normalizeGear({
      id: "proto-mask",
      slot: "mask",
      brand: "Striker's Battlegear",
      brandType: "brand",
      core: "wd",
      coreValue: 22.5,
      attributes: [
        { type: "wd", value: 20 },
        { type: "chd", value: 17 },
      ],
      talent: null,
      prototype: true,
    });

  it("Auftraggeber-Beispiel: WD 20 % -> 15 %, CHD 17 % -> 12 % (High-End-Maxima)", () => {
    const [capped] = applyPrototypeCapToGear([mkProtoGear()]);
    const wd = capped.attributes.find((a) => a.type === "wd")!;
    const chd = capped.attributes.find((a) => a.type === "chd")!;
    expect(wd.value).toBe(15);
    expect(chd.value).toBe(12);
  });

  it("Prototyp-Kern WD 22,5 -> 15 (High-End-Max)", () => {
    const [capped] = applyPrototypeCapToGear([mkProtoGear()]);
    expect(capped.coreValue).toBe(15);
  });

  it("Nicht-Prototyp-Teile bleiben unveraendert; Werte unterhalb des Caps bleiben stehen", () => {
    const normal = normalizeGear({
      id: "normal-mask",
      slot: "mask",
      brand: "Grupo Sombra S.A.",
      brandType: "brand",
      core: "wd",
      coreValue: 10,
      attributes: [{ type: "chc", value: 5 }],
      talent: null,
      prototype: false,
    });
    const [cappedNormal] = applyPrototypeCapToGear([normal]);
    expect(cappedNormal.coreValue).toBe(10);
    expect(cappedNormal.attributes[0].value).toBe(5);
    const lowProto = normalizeGear({
      ...normal,
      id: "low-proto",
      prototype: true,
      coreValue: 8,
      attributes: [{ type: "chc", value: 3 }],
    });
    const [cappedLow] = applyPrototypeCapToGear([lowProto]);
    expect(cappedLow.coreValue).toBe(8);
    expect(cappedLow.attributes[0].value).toBe(3);
  });

  it("Prototyp-Waffe: Kern 1 (22,5 -> 15) und Attribute gedeckelt", () => {
    const protoWeapon = normalizeWeapon({
      id: "proto-w",
      name: "Proto-Waffe",
      type: "ar",
      isPrototype: true,
      attributes: {
        core1: 22.5,
        core2Type: "dth",
        core2Val: 30,
        minorType: "dttooc",
        minorVal: 15,
      },
    });
    const capped = applyPrototypeCapToWeapon(protoWeapon);
    expect(capped.attributes.core1).toBe(15);
    expect(capped.attributes.core2Val).toBe(21);
    expect(capped.attributes.minorVal).toBe(10);
  });

  it("Nicht-Prototyp-Waffe bleibt unveraendert", () => {
    const normal = normalizeWeapon({
      id: "normal-w",
      name: "N",
      type: "ar",
      isPrototype: false,
    });
    expect(applyPrototypeCapToWeapon(normal)).toBe(normal);
  });
});
