import { describe, it, expect } from "vitest";
import { tCore, tGearAttr, tWeaponAttr, tItemName, tTalentName, tWeaponName, tGearSetName } from "../itemNames";

describe("ItemName-i18n: Attribut- und Kern-Uebersetzungen (Auftraggeber-Liste 1)", () => {
  it("Kernattribute DE<->EN (Waffenschaden/Weapon Damage, Ruestung/Armor, Skill Tier)", () => {
    expect(tCore("wd", "de", "x")).toBe("Waffenschaden");
    expect(tCore("wd", "en", "x")).toBe("Weapon Damage");
    expect(tCore("armour", "en", "x")).toBe("Armor");
    expect(tCore("skill", "en", "x")).toBe("Skill Tier");
  });

  it("Offensive Attribute: CHC/CHD/HSD/DTA/DtH/DtTooc", () => {
    expect(tGearAttr("chc", "en", "x")).toBe("Critical Hit Chance (CHC)");
    expect(tGearAttr("chd", "en", "x")).toBe("Critical Hit Damage (CHD)");
    expect(tWeaponAttr("hsd", "en", "x")).toBe("Headshot Damage (HSD)");
    expect(tGearAttr("dta", "en", "x")).toBe("Damage to Armor (DtA)");
    expect(tGearAttr("dth", "en", "x")).toBe("Damage to Health (DtH)");
    expect(tGearAttr("dttooc", "en", "x")).toBe("Damage to Targets Out of Cover (DtTooc)");
  });

  it("Defensive Attribute: Armor Regen, AoK, Health, HazPro, PfE, Explosive Resistance", () => {
    expect(tGearAttr("armorregen", "en", "x")).toBe("Armor Regen");
    expect(tGearAttr("aok", "en", "x")).toBe("Armor On Kill (AoK)");
    expect(tGearAttr("health", "en", "x")).toBe("Health");
    expect(tGearAttr("hazard", "en", "x")).toBe("Hazard Protection (HazPro)");
    expect(tGearAttr("pfe", "en", "x")).toBe("Protection from Elites (PfE)");
    expect(tGearAttr("explres", "en", "x")).toBe("Explosive Resistance");
  });

  it("Fertigkeiten-Attribute: Skill Damage, Haste, Repair, Incoming Repairs, Status Effects, Duration", () => {
    expect(tGearAttr("skilldmg", "en", "x")).toBe("Skill Damage");
    expect(tGearAttr("skillhaste", "en", "x")).toBe("Skill Haste");
    expect(tGearAttr("repair", "en", "x")).toBe("Repair Skills");
    expect(tGearAttr("incomrepair", "en", "x")).toBe("Incoming Repairs");
    expect(tGearAttr("status", "en", "x")).toBe("Status Effects");
    expect(tGearAttr("skillduration", "en", "x")).toBe("Skill Duration");
  });

  it("DE-Anzeige bleibt unveraendert, Fallback greift bei unbekanntem Key", () => {
    expect(tGearAttr("chc", "de", "x")).toBe("Kritische Trefferchance");
    expect(tGearAttr("unbekannt", "en", "Fallback-Text")).toBe("Fallback-Text");
    expect(tItemName("weapon", "whatever", "en", "DB-Name")).toBe("DB-Name");
  });
});

describe("Talent-Namen DE<->EN (Auftraggeber-Liste 2)", () => {
  it("Schadens-/Kill-Talente", () => {
    expect(tTalentName("Strapaziert", "en", "x")).toBe("Strained");
    expect(tTalentName("Brotkorb", "en", "x")).toBe("Breadbasket");
    expect(tTalentName("Nah und persönlich", "en", "x")).toBe("Close & Personal");
    expect(tTalentName("Bumerang", "en", "x")).toBe("Boomerang");
  });

  it("Statuseffekt- und Fertigkeiten-/Utility-Talente", () => {
    expect(tTalentName("Entzündet", "en", "x")).toBe("Ignited");
    expect(tTalentName("Blind", "en", "x")).toBe("Eyeless");
    expect(tTalentName("Synchronisiert", "en", "x")).toBe("In Sync");
    expect(tTalentName("Zukunft", "en", "x")).toBe("Future Perfect");
    expect(tTalentName("Flinke Hände", "en", "x")).toBe("Fast Hands");
    expect(tTalentName("Bewahrung", "en", "x")).toBe("Preservation");
  });

  it("Gattungs-Talente (Raserei etc.) und DE-Fallback", () => {
    expect(tTalentName("Raserei", "en", "x")).toBe("Frenzy");
    expect(tTalentName("Aus den Angeln", "en", "x")).toBe("Unhinged");
    expect(tTalentName("Raserei", "de", "x")).toBe("x"); // DE-Anzeige laeuft ueber DB-Label, Fallback
    expect(tTalentName("Unbekanntes Talent", "en", "DB-Name")).toBe("DB-Name");
  });
});

describe("Exotische Waffen-Namen DE<->EN (Auftraggeber-Liste 3, unvollstaendig)", () => {
  it("Sturmgewehre: Eagle Bearer/Adlertraeger, St. Elmo's Engine/St.-Elmos-Feuer", () => {
    expect(tWeaponName("Eagle Bearer", "de", "x")).toBe("Adlertr\u00e4ger");
    expect(tWeaponName("Eagle Bearer", "en", "x")).toBe("Eagle Bearer");
    expect(tWeaponName("St. Elmo's Engine", "de", "x")).toBe("St.-Elmos-Feuer");
    expect(tWeaponName("Chameleon", "de", "x")).toBe("Cham\u00e4leon");
  });

  it("Klammervarianten werden auf Basisnamen gemappt (Pestilence (M249 B) -> Pestilenz)", () => {
    expect(tWeaponName("Pestilence (M249 B)", "de", "x")).toBe("Pestilenz");
    expect(tWeaponName("Iron Lung (MG5)", "de", "x")).toBe("Eiserne Lunge");
    expect(tWeaponName("Busy Little Bee (Custom PF45)", "de", "x")).toBe("Flei\u00dfiges Bienchen");
  });

  it("Unveraenderte Namen und Fallback", () => {
    expect(tWeaponName("Nemesis", "de", "x")).toBe("Nemesis");
    expect(tWeaponName("Regulus", "de", "x")).toBe("Regulus");
    expect(tWeaponName("ACR", "de", "ACR")).toBe("ACR");
    expect(tWeaponName("Unbekannte Waffe", "en", "DB-Name")).toBe("DB-Name");
  });
});

describe("Gearset-Namen DE<->EN (Auftraggeber-Liste 4)", () => {
  it("Komplett uebersetzte Sets per DB-Key", () => {
    expect(tGearSetName("striker", "de", "x")).toBe("St\u00fcrmer-Kampfausr\u00fcstung");
    expect(tGearSetName("truepatriot", "de", "x")).toBe("Wahrer Patriot");
    expect(tGearSetName("ongoing", "de", "x")).toBe("Aktivierte Direktive");
    expect(tGearSetName("acesandeights", "de", "x")).toBe("Asse und Achten");
    expect(tGearSetName("foundry", "de", "x")).toBe("Gie\u00dferei-Bollwerk");
    expect(tGearSetName("eclipse", "de", "x")).toBe("Eclipse-Protokoll");
    expect(tGearSetName("huntersfury", "de", "x")).toBe("Zorn des J\u00e4gers");
  });

  it("DB-Namen werden auf Keys gemappt ('Striker's Battlegear' -> Stuermer)", () => {
    expect(tGearSetName("Striker's Battlegear", "de", "x")).toBe("St\u00fcrmer-Kampfausr\u00fcstung");
    expect(tGearSetName("Tip of the Spear", "de", "x")).toBe("Spitze des Speers");
    expect(tGearSetName("Negotiator's Dilemma", "de", "x")).toBe("Dilemma des Verhandlungsf\u00fchrers");
  });

  it("Ident-Eintraege und EN-Richtung, Fallback fuer nicht gelieferte Sets", () => {
    expect(tGearSetName("hardwired", "de", "x")).toBe("Hard Wired");
    expect(tGearSetName("heartbreaker", "de", "x")).toBe("Heartbreaker");
    expect(tGearSetName("umbra", "de", "x")).toBe("Umbra Initiative");
    expect(tGearSetName("striker", "en", "x")).toBe("Striker's Battlegear");
    expect(tGearSetName("refactor", "de", "Refactor")).toBe("Refactor");
  });
});
