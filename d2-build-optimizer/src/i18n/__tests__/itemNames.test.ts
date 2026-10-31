import { describe, it, expect } from "vitest";
import { tCore, tGearAttr, tWeaponAttr, tItemName, tTalentName } from "../itemNames";

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
