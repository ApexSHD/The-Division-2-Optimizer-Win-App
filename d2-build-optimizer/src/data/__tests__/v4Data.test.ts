import { describe, it, expect } from "vitest";
import modsJson from "../../db/mod.json";
import {
  IMMUNITY_THRESHOLDS,
  SKILLS,
  SPECIALIZATIONS,
  GEAR_TALENTS,
  SOURCES,
  HARD_CAPS,
  SLOT_RULES,
  VALUE_RANGES,
  CHC_TARGET,
  DATA_VERSION_V4,
  AXES,
  capValue,
  teamSizeFactor,
} from "../v4Data";

describe("V4-Datenbasis (Issue #89)", () => {
  it("enthält alle Datenbanken mit Datenversion", () => {
    expect(DATA_VERSION_V4.skills).toBe("skills_v1");
    expect(DATA_VERSION_V4.specializations).toBe("specializations_v1");
    expect(DATA_VERSION_V4.attributeRules).toBe("attribute_rules_v1");
    expect(DATA_VERSION_V4.sources).toBe("sources_v1");
    expect(DATA_VERSION_V4.talents).toBe("v2");
    expect(DATA_VERSION_V4.dataStand).toBeTruthy();
  });

  it("kennt genau sechs Spezialisierungen", () => {
    expect(SPECIALIZATIONS).toHaveLength(6);
    const keys = SPECIALIZATIONS.map((s) => s.key).sort();
    expect(keys).toEqual([
      "demolitionist",
      "firewall",
      "gunner",
      "sharpshooter",
      "survivalist",
      "technician",
    ]);
  });

  it("Techniker vergibt einen harten Skill-Stufen-Bonus", () => {
    const technician = SPECIALIZATIONS.find((s) => s.key === "technician");
    expect(technician).toBeDefined();
    const bonus = technician!.skill_boni.find(
      (b) => b.name === "Gratis-Fertigkeitenrang",
    );
    expect(bonus?.wert).toBe(1);
  });

  it("jede Spezialisierung deckt alle sechs Achsen in axis_relevance ab", () => {
    for (const spec of SPECIALIZATIONS) {
      for (const axis of AXES) {
        expect(spec.axis_relevance[axis]).toBeDefined();
      }
    }
  });

  it("enthält die wesentlichen Skills mit Varianten (Heilbrut, Aufruhrschaum, Schild)", () => {
    const keys = SKILLS.map((s) => s.key);
    expect(keys).toContain("hive");
    expect(keys).toContain("chem_launcher");
    expect(keys).toContain("shield");
    expect(keys).toContain("seeker_mine");
    const hive = SKILLS.find((s) => s.key === "hive")!;
    expect(hive.variants.map((v) => v.key)).toContain("restorer");
    const chem = SKILLS.find((s) => s.key === "chem_launcher")!;
    expect(chem.variants.map((v) => v.key)).toContain("riot_foam");
  });

  it("strukturierte Gear-Talente folgen dem BUF-Schema (Striker bestätigt)", () => {
    const keys = GEAR_TALENTS.map((t) => t.key);
    expect(keys).toContain("striker_gamble");
    expect(keys).toContain("eclipse_protocol");
    expect(keys).toContain("future_initiative_chest");
    const striker = GEAR_TALENTS.find((t) => t.key === "striker_gamble")!;
    expect(striker.value_status).toBe("bestätigt");
    expect(striker.stapel).toContain("100");
    const teamTalents = GEAR_TALENTS.filter((t) => t.team_wirkung);
    expect(teamTalents.length).toBeGreaterThan(0);
    for (const t of teamTalents) {
      expect(t.uptime).toBeGreaterThanOrEqual(0);
      expect(t.uptime).toBeLessThanOrEqual(1);
    }
  });

  it("Caps: CHC 60 %, Gefahrenschutz 100 %, Skill-Stufe 6", () => {
    const chc = HARD_CAPS.find((c) => c.attr === "chc");
    expect(chc?.cap).toBe(60);
    const hazard = HARD_CAPS.find((c) => c.attr === "hazard");
    expect(hazard?.cap).toBe(100);
    const tier = HARD_CAPS.find((c) => c.attr === "skill_tier");
    expect(tier?.cap).toBe(6);
  });

  it("CHC-Zielwert: Spieler-Eingabe, Standard 50, max 60, ohne Kopfschuss/CC-Rollen", () => {
    expect(CHC_TARGET.player_input).toBe(true);
    expect(CHC_TARGET.default).toBe(50);
    expect(CHC_TARGET.max).toBe(60);
    expect(CHC_TARGET.roles_irrelevant).toContain("Kontrolle (CC)");
  });

  it("Slot-Regeln: sechs Gear-Slots mit Kernen und Rucksack/Weste-Hinweis (Gearset-Regel #94)", () => {
    expect(SLOT_RULES).toHaveLength(6);
    const slots = SLOT_RULES.map((s) => s.slot).sort();
    expect(slots).toEqual([
      "Handschuhe",
      "Holster",
      "Knieschoner",
      "Maske",
      "Rucksack",
      "Weste",
    ]);
    const backpack = SLOT_RULES.find((s) => s.slot === "Rucksack")!;
    const chest = SLOT_RULES.find((s) => s.slot === "Weste")!;
    expect(backpack.hint).toContain("Gearset");
    expect(chest.hint).toContain("Gearset");
  });

  it("Wertebereiche liegen für jedes vergebene Attribut vor", () => {
    expect(VALUE_RANGES.chc.max).toBeGreaterThan(0);
    expect(VALUE_RANGES.chd.max).toBeGreaterThan(VALUE_RANGES.chd.min);
    expect(VALUE_RANGES.hazard.max).toBeLessThanOrEqual(12.5);
  });

  it("capValue deckelt CHC bei 60 und lässt uncapped Werte unverändert", () => {
    expect(capValue("chc", 65)).toBe(60);
    expect(capValue("chc", 55)).toBe(55);
    expect(capValue("chd", 200)).toBe(200);
  });

  it("Teamgröße-Faktor nach Lastenheft 4.5", () => {
    expect(teamSizeFactor("self", 4)).toBe(1);
    expect(teamSizeFactor("team", 4)).toBe(4);
    expect(teamSizeFactor("team_ohne_mich", 4)).toBe(3);
    expect(teamSizeFactor("team_ohne_mich", 1)).toBe(0);
  });

  it("Bezugsquellen: Stufe nur A oder B, MVP-Teile vorhanden", () => {
    for (const s of SOURCES) {
      expect(["A", "B"]).toContain(s.stage);
    }
    const items = SOURCES.map((s) => s.item);
    expect(items.some((i) => i.includes("Striker"))).toBe(true);
    expect(items.some((i) => i.includes("St. Elmo"))).toBe(true);
  });
});

describe("Immunitätsschwellen & bestätigte Caps (Nutzervorgabe 29.11.)", () => {
  it("Statusresistenz-Immunität ab den Schwellwerten (Schock 86 %, Brand 94 %, Festsetzen 98 % …)", () => {
    expect(IMMUNITY_THRESHOLDS.shock).toBe(86.0);
    expect(IMMUNITY_THRESHOLDS.poison).toBe(89.2);
    expect(IMMUNITY_THRESHOLDS.blind_deaf).toBe(91.0);
    expect(IMMUNITY_THRESHOLDS.bleed).toBe(93.8);
    expect(IMMUNITY_THRESHOLDS.burn).toBe(94.0);
    expect(IMMUNITY_THRESHOLDS.disorient).toBe(98.0);
    expect(IMMUNITY_THRESHOLDS.disrupt).toBe(98.0);
    expect(IMMUNITY_THRESHOLDS.ensnare).toBe(98.0);
  });

  it("Schutz-vor-Eliten-Cap 80 % ist bestätigt (Nutzervorgabe), nicht mehr Annahme", () => {
    const pfe = HARD_CAPS.find((c) => c.attr === "pfe");
    expect(pfe?.cap).toBe(80);
    expect(pfe?.value_status).toBe("bestätigt");
  });
});

describe("Waffen-Mod-Maxwerte (Nutzervorgabe mods_v3)", () => {
  interface WeaponMod {
    name: string;
    slotTypes: string[];
    bonus: { type: string; val: number } | null;
    penalty?: { type: string; val: number } | null;
    note?: string;
  }
  const mods = (modsJson as unknown as {
    version: string;
    slots: Record<string, WeaponMod[]>;
    special_exclusive: Array<{ name: string; spec: string }>;
  });

  it("mod.json ist mods_v3 mit Spezial-Exklusiv-Mods", () => {
    expect(mods.version).toBe("mods_v3");
    expect(mods.special_exclusive).toHaveLength(2);
    expect(mods.special_exclusive.some((m) => m.spec === "technician")).toBe(true);
    expect(mods.special_exclusive.some((m) => m.spec === "firewall")).toBe(true);
  });

  it("Max-Werte je Platz: Optik CHC 5 / CHD 10 / HSD 10, Mündung CHD 10 / CHC 5, Unterlauf CHC 5", () => {
    const find = (slot: string, name: string) =>
      mods.slots[slot].find((m) => m.name === name);
    expect(find("optic", "PRO Red Dot Sight (Rugged Mini Reflex)")?.bonus).toEqual({ type: "chc", val: 5 });
    expect(find("optic", "EXPS3 Holo Sight (Russisches Rotpunkt)")?.bonus).toEqual({ type: "chd", val: 10 });
    expect(find("optic", "VX-1 Scope 12x")?.bonus).toEqual({ type: "hsd", val: 10 });
    expect(find("muzzle", "Omega 5.56/7.62 Suppressor")?.bonus).toEqual({ type: "chd", val: 10 });
    expect(find("muzzle", "Praezisions-Muendungsbremse")?.bonus).toEqual({ type: "chc", val: 5 });
    expect(find("underbarrel", "Kompakter Laserpointer")?.bonus).toEqual({ type: "chc", val: 5 });
  });

  it("Alter Fehler korrigiert: Unterlauf-CHC war +10 %, korrekt ist +5 %", () => {
    const laser = mods.slots.underbarrel.find(
      (m) => m.name === "Compact Coupled Small Laser Pointer",
    );
    expect(laser?.bonus?.val).toBe(5);
  });

  it("Magazin-Highlights: Robustes +20 Pat., LMG-Tasche +50 (mit Nachlade-Malus), Shotgun-Röhrenfeder +30 % Nachladen", () => {
    const robust = mods.slots.magazine.find((m) => m.name.includes("Robustes erweitertes"));
    expect(robust?.bonus).toEqual({ type: "magSize", val: 20 });
    const lmgBelt = mods.slots.magazine.find((m) => m.name.includes("Grosse Tasche"));
    expect(lmgBelt?.bonus).toEqual({ type: "magSize", val: 50 });
    expect(lmgBelt?.penalty).toEqual({ type: "reloadSpeed", val: -10 });
    const tube = mods.slots.magazine.find((m) => m.name.includes("Röhrenfeder"));
    expect(tube?.bonus).toEqual({ type: "reloadSpeed", val: 30 });
  });
});
