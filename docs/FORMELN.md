# Formeldokument — Berechnungs-Engine

Nachvollziehbare Darstellung aller Schadensformeln der Engine (`d2-build-optimizer/src/data/damage.ts`). Grundlage für Spiel-Referenzwert-Tests (Issue #62) und das Annahmen-Panel (Issue #64).

Stand: nach den Code-Review-Fixes (Issues #67, #61) — engine-seitig verbindlich ist ausschließlich der Code; dieses Dokument beschreibt ihn.

---

## 1. Die Hauptformel (Übersicht)

```
Ø Schaden pro Treffer =
    Basis
    × Know-How
    × WD (Gesamtwaffenschaden, additiv)
    × TWD (Talent-Waffenschaden, additiv — derzeit immer 1)
    × DTA/DTH/DTTOOC (situativ, gewichtet mit Gegnerprofil)
    × Amp (multiplikative Amplifier — derzeit leer)
    × HSD-und-Crit-Erwartung
```

`effectiveDps = Ø Schaden pro Treffer × RPM × Feuerrate-Bonus / 60`

Code: `computeDamage()` in `src/data/damage.ts`.

---

## 2. Bonus-Kategorien: additiv vs. multiplikativ

### 2.1 Additiv innerhalb einer Gruppe — alle WD-Quellen summieren sich

`wdGesamt` („Waffenschaden-Kategorie") ist die **Summe** aller Quellen mit WD-Anteil:

| Quelle | Beispiel | Code-Stelle |
|---|---|---|
| Waffen-Attribut Core 1 | +15 % | `weapon.attributes.core1` |
| Gear-Kerne (rot) | 6 × +15 % = +90 % | `aggregateBuild` (g.core === "wd") |
| Gear-Nebenattribut „wd" | +15 % (Minor) | `aggregateBuild` |
| SHD-Uhr | +10 % bei SHD 1000 | `shdBonusFor(level, "wd")` |
| Spezialisierung (Gattungs-Bonus) | Scharfschütze: +15 % auf DMR | `specBonusFor(...).weaponTypeWd` |
| Mods | WD-Mod +X % | `applyModContributions` |
| Brand-Set-Boni | Česká 2p +24 % (nur Shotgun) | `applySetBonuses` (`wd_by_weapon`) |

**Formel:** `WD-Multiplikator = 1 + (core1 + wdGesamt + weaponTypeWd) / 100`

Alle weiteren Kategorien (CHC, CHD, HSD, DTA, DTH, DTTOOC) werden analog **additiv innerhalb ihrer Kategorie** aggregiert (siehe `aggregateBuild`, inkl. SHD-Uhr, Mods, Set-Boni).

### 2.2 Multiplikativ zwischen den Gruppen

Die Kategorien werden **multiplikativ** verknüpft:

```
rawHit        = Basis × KnowHow × WDMult × TWDMult
nonCritBody   = rawHit × DTAMult × DTHMult × DTTOOCMult × AmpMult
nonCritHit    = nonCritBody × (1 + HSD/100 × Headshot-Anteil)
critHit       = nonCritHit × (1 + CHD/100)
Ø pro Treffer = nonCritHit × (1 − CHC) + critHit × CHC
```

---

## 3. Know-How (Grundschaden-Multiplikator)

`KnowHowMult = 1 + KnowHowStufe / 100` — direkt auf den **Basis-Schaden** der Waffe, **vor** allen anderen Boni. Beispiel: Stufe 30 → × 1,30.

---

## 4. Situative Boni und das Gegnerprofil

DTA (Rüstungsschaden), DTH (Lebenspunktschaden) und DTTOOC (Schaden gg. ungedeckte Ziele) werden mit dem **Gegnerprofil gewichtet**:

| Profil-Wert | Bedeutung | Standard |
|---|---|---|
| armorShare | Rüstungsanteil der Gegner | 80 % |
| healthShare | Lebenspunkte-Anteil | 20 % |
| oocShare | Anteil ungedeckter Gegner | 70 % |
| headshotShare | eigener Headshot-Anteil | 0 % |

`DTAMult = 1 + (DTA / 100) × armorShare` — usw. für DTH/DTTOOC. HSD wird mit dem Headshot-Anteil gewichtet: `1 + (HSD / 100) × headshotShare` (seit dem Review-Fix **linear**, previously versehentlich quadratisch).

---

## 5. Kritische Treffer und Caps

- **CHC-Cap: 60 %** (`CHC_CAP`). `cappedChc = min(CHC gesamt, 60)`. Überschuss über 60 % fließt **nicht** in die Erwartung ein — er ist ein verschwendeter Stat (Bestrafung im Ranking: Issue #64).
- **CHD** wirkt multiplikativ auf den Treffer: `critHit = nonCritHit × (1 + CHD/100)`.
- **Erwartungswert:** `Ø pro Treffer = nonCritHit × (1 − CHC) + critHit × CHC` mit dem gedeckelten CHC.

**Wichtig — Zielwert ≠ Cap:** der „Zielwert kritische Trefferchance" (Standard 50 %, Einstellung im Optimizer) ist ein **Ranking-Kriterium** (Builds, die das Ziel erreichen, rangieren vor solchen darunter), keine Rechengröße. Der Cap (60 %) ist die Rechengröße.

---

## 6. RPM / DPS

`effectiveDps = Ø pro Treffer × RPM × Feuerrate-Bonus / 60`, wobei der Feuerrate-Bonus nur zählt, wenn die Waffe als zweiten Kern „rof" hat: `rofMult = 1 + core2Val/100`.

---

## 7. Set-Boni (Brand & Green)

- **Brand-Sets (1/2/3 Teile):** numerische `bonuses_pve` aus der DB, z. B. Česká 1p +8 % CHC (→ Kategorie CHC additiv). `wd_by_weapon`-Boni (z. B. +24 % Shotgun-Schaden) greifen **nur bei passender Waffengattung** und fließen in die WD-Kategorie.
- **Green-Sets (2/3/4 Teile):** numerische `bonuses` aus der DB (z. B. Striker 3p +15 % Feuerrate — Feuerrate wird derzeit als Attribut nicht in DPS eingerechnet; nur CHC/CHD/HSD/WD-fähige Boni wirken).
- **Nicht modelliert:** Stack-basierte 4er-Boni (z. B. Striker's Gamble). Die DB führt dazu ein `modeled`-Feld; Anzeige geplant im Annahmen-Panel (#64).

## 8. Bewusst nicht abgebildet (Stand dieses Dokuments)

Diese im Spiel existierenden Effekte sind in der Engine derzeit **nicht** enthalten und sollen gegen Ingame-Werte geprüft werden (#62):

1. **Basis-Kopfschuss-Multiplikator** (im Spiel hat jede Waffe einen eingebauten HSD-Grundwert, z. B. +55 % bei ARs — die Waffen-DB führt „HSD" als Stat, `computeDamage` nutzt ihn nicht)
2. **Basis-CHD** (im Spiel +25 % Grundwert auf jedem Crit)
3. **RPM-Preis-Multiplikatoren** und Waffenhandling-Effekte auf realen DPS
4. **Talente** (`talentTotalWd`/`talentAmps` existieren als Parameter, werden aber nie übergeben — Schalter ohne Wirkung bis zur Umsetzung)
5. **Exotic-Perks** (Catharsis, Memento, Coyote's Mask usw.)

Sobald ein Punkt implementiert wird, ist dieses Dokument fortzuschreiben und der Test in `src/data/__tests__/damage.test.ts` zu ergänzen.

---

## 9. Gegnerprofil-Quelle

Alle Profil-Werte kommen aus den Optimierungs-Einstellungen (`enemyProfileFromSettings`), armor/health werden auf Summe 1 normiert (Standard-Annahme: 80 % Rüstung).
