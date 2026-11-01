import { describe, expect, it } from "vitest";
import { getDb } from "../db";
import { emptyUserDb, mergeDb, sanitizeUserDb, parseBonusLines, formatBonusLines } from "../userDb";

describe("mergeDb (Spiel-Basisdaten + lokale Overrides)", () => {
  it("ohne Overrides bleibt die Standard-DB unverändert", async () => {
    const base = await getDb();
    expect(mergeDb(base, undefined)).toBe(base);
    expect(mergeDb(base, emptyUserDb())).toEqual(base);
  });

  it("Override überschreibt einen bestehenden Eintrag, null löscht ihn, neue Keys werden angehängt", async () => {
    const base = await getDb();
    const first = base.weapons[0];
    const overrides = emptyUserDb();
    overrides.weapons[first.name] = { rpm: first.rpm + 10 };
    overrides.weapons[base.weapons[1].name] = null;
    overrides.weapons["Testwaffe X"] = { name: "Testwaffe X", baseDamage: 123 };
    overrides.weaponTalents[base.talents[0].key] = { label: "Neues Label" };
    overrides.gearTalents["neues_gear_talent"] = { key: "neues_gear_talent", label: "Neu", slot: "chest", note: "" };
    overrides.mods["Testmod"] = { name: "Testmod", slot: "optic", slotTypes: [], bonus: "wd +5", penalty: null };

    const merged = mergeDb(base, overrides);
    const edited = merged.weapons.find((w) => w.name === first.name)!;
    expect(edited.rpm).toBe(first.rpm + 10);
    expect(edited.baseDamage).toBe(first.baseDamage);
    expect(merged.weapons.some((w) => w.name === base.weapons[1].name)).toBe(false);
    expect(merged.weapons.some((w) => w.name === "Testwaffe X" && w.baseDamage === 123)).toBe(true);
    expect(merged.talents.find((t) => t.key === base.talents[0].key)!.label).toBe("Neues Label");
    expect(merged.gearTalents.some((g) => g.key === "neues_gear_talent")).toBe(true);
    expect(merged.mods.some((m) => m.name === "Testmod")).toBe(true);
    expect(merged.weapons.length).toBe(base.weapons.length);
  });

  it("Brand-Items/Gear-Set-Items werden aus den gemergten Sets abgeleitet", async () => {
    const base = await getDb();
    const overrides = emptyUserDb();
    overrides.brandSets["test_brand"] = { key: "test_brand", name: "Test Brand", bonusEntries: [{ pieces: 2, attr: "wd", val: 10 }] };
    const merged = mergeDb(base, overrides);
    expect(merged.brandSets.some((b) => b.key === "test_brand")).toBe(true);
    expect(merged.brandItems.some((b) => b.brand === "Test Brand")).toBe(true);
  });

  it("strukturierte Set-Boni (bonusEntries) ersetzen die Standardwerte, wd_by_weapon inkl. Waffentyp", async () => {
    const base = await getDb();
    const fenris = base.brandSets.find((b) => b.key === "fenris")!;
    expect(fenris.bonusEntries.length).toBeGreaterThan(0);
    const overrides = emptyUserDb();
    overrides.brandSets["fenris"] = {
      bonusEntries: [
        { pieces: 1, attr: "wd_by_weapon", val: 15, weaponType: "AR" },
        { pieces: 2, attr: "chc", val: 5 },
      ],
    };
    const merged = mergeDb(base, overrides);
    const m = merged.brandSets.find((b) => b.key === "fenris")!;
    expect(m.bonusEntries).toEqual([
      { pieces: 1, attr: "wd_by_weapon", val: 15, weaponType: "AR" },
      { pieces: 2, attr: "chc", val: 5 },
    ]);
    expect(m.bonuses).toEqual([]);
    expect(merged.setBonusAttrs).toContain("chc");
  });

  it("neue Attribute landen über attrNames im Dropdown-Stamm (setBonusAttrs)", async () => {
    const base = await getDb();
    const overrides = emptyUserDb();
    overrides.attrNames["mein_attr"] = { de: "Mein Attribut", en: "My attribute" };
    const merged = mergeDb(base, overrides);
    expect(merged.setBonusAttrs).toContain("mein_attr");
  });

  it("sanitizeUserDb ist robust gegen ungültige Eingaben", () => {
    expect(sanitizeUserDb(null)).toEqual(emptyUserDb());
    expect(sanitizeUserDb("kaputt")).toEqual(emptyUserDb());
    const s = sanitizeUserDb({ weapons: { ACR: { rpm: 700 } }, mods: [1, 2], gear: null });
    expect(s.weapons).toEqual({ ACR: { rpm: 700 } });
    expect(s.mods).toEqual({});
    expect(s.gear).toEqual({});
  });
});

describe("Bonus-Zeilen (Brand-/Gear-Sets)", () => {
  it("parst und formatiert Zeilen wie '2× +10% …'", () => {
    const parsed = parseBonusLines("2× +10% Waffenschaden\n3x Kritische Trefferchance\n4: Panzerung\nFreier Text");
    expect(parsed).toEqual([
      { pieces: 2, bonus: "+10% Waffenschaden" },
      { pieces: 3, bonus: "Kritische Trefferchance" },
      { pieces: 4, bonus: "Panzerung" },
      { pieces: 1, bonus: "Freier Text" },
    ]);
    expect(formatBonusLines(parsed)).toBe("2× +10% Waffenschaden\n3× Kritische Trefferchance\n4× Panzerung\n1× Freier Text");
    expect(parseBonusLines("")).toEqual([]);
  });
});
