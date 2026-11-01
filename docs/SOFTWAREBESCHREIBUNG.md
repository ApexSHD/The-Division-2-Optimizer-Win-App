# Softwarebeschreibung – Redesign als Windows-Desktop-App

**Projekt:** The Division 2 – Build Optimizer (Arbeitstitel „D2 Build Optimizer for Windows")
**Grundlage:** github.com/ApexSHD/division2-build-optimizer (Web-App, Alpha)
**Dokumenttyp:** Allgemeine Softwarebeschreibung / Lastenheft-Entwurf
**Stand:** Oktober 2026

---

## 1. Zweck und Zielsetzung

Der Build Optimizer ist ein Fan-Werkzeug für Tom Clancy's The Division 2. Er hilft Spielern („Agenten"), ihre Ausrüstung – Waffen, Gear-Teile, Mods und Talente – zu erfassen, zu bewerten und zur bestmöglichen Kombination (Build) zusammenzustellen, vor allem mit Blick auf Schadensausstoß und Effizienz.

Die bestehende Lösung ist eine statische Web-App (HTML, JavaScript, Tailwind CSS), die über einen lokalen Webserver oder GitHub Pages läuft. Ziel des Redesigns ist eine eigenständige, installierbare Windows-Anwendung, die:

- ohne Browser und lokalen Webserver startet (Doppelklick),
- vollständig offline funktioniert,
- Daten dauerhaft und sicher auf dem PC speichert (statt im Browser-Speicher),
- eine moderne, Windows-typische Bedienoberfläche bietet,
- die bewährte Berechnungslogik und die Datenbanken unverändert weiterverwendet.

## 2. Zielgruppe

- PvE-/PvP-Spieler von The Division 2, die Builds theoretisch durchrechnen („Theorycrafting").
- Fortgeschrittene Nutzer, die eigene Datenbestände pflegen (Admin-Funktion).
- Primärsprache Deutsch, Englisch als zweite Sprache vorgesehen.

## 3. Ist-Zustand (Web-Version)

| Bereich | Ist |
| --- | --- |
| Technik | HTML5, JavaScript (ES6+), Tailwind CSS (vorkompiliert) |
| Start | Lokaler HTTP-Server nötig (`fetch()` der JSON-Daten) oder GitHub Pages |
| Daten | `weapons.json`, `gear.json`, `mod.json`, `talent.json`, `talents-display.json` |
| Speicherung | Browser-localStorage, versioniertes Schema (v17) mit Migration |
| Import | CSV-/Excel-Vorlagen für Waffen und Gear (`vorlage_*.xlsx`, `beispiel_*.csv`) |
| Tests | jsdom-Regressionstests mit Referenzwerten, CI über GitHub Actions |
| Reiter | Global, Waffen, Gear, Vergleich, Set-Vergleich, Einstellungen, Admin |

Schwächen, die das Redesign adressiert: Abhängigkeit vom Browser-Speicher (Datenverlust beim Leeren des Caches, Größenlimit), umständlicher Start lokal, kein echter Datei-Export/-Import, Logik verteilt auf zwei große Skriptdateien.

## 4. Funktionsumfang (Soll)

### 4.1 Globale Einstellungen / Charakter

- SHD-Level (Standard 1.000) als Basis der SHD-Uhr-Boni: 16 Attribute in den Kategorien Angriff (Offensive), Verteidigung (Defensive), Handhabung (Weapon Handling) und Nutzen (Utility); die Boni steigen mit bis zu 50 Stufen pro Attribut (z. B. Waffenschaden +10,0 % bei +0,2 % pro Stufe) und fließen in die spätere Kalkulation ein.
- Auswahl von Spezialisierung, Spielmodus (PvE/PvP; PvP wird später integriert) und aktivem Saisonstand (z. B. Y8S3).
- Einstellungen für Optimierung: Zielwert kritische Trefferchance (Standard 50 %, Bereich 10–60 %), Schalter für Waffen-Talente, Ausrüstungs-Talente (Weste/Rucksack) und exotische Gear-Perks sowie Gegnerprofil (Rüstungs-/Lebensenergie-/Ungedeckt-/Kopfschuss-Anteile für DTA / DTH / DTToOC / HSD).
- Live-Zusammenfassung der Gesamtwerte in einer Seitenleiste (vollständig mit der Berechnungs-Engine; bis dahin Anzeige der SHD-Uhr-Boni).

### 4.2 Waffen-Inventar

- Waffen anlegen, bearbeiten, löschen, filtern und sortieren.
- Vorbelegung aus der Waffen-Datenbank (inkl. Named-/Exotic-Varianten mit festen Attributen).
- Talentauswahl (High-End- und Exotic-Talente; 20 Exotic-Talente mit Stack-Reglern).
- Automatische Mod-Optimierung: Wahl der besten kompatiblen Mods (Optik, Mündung, Unterlauf, Magazin) je Slot passend zum Crit-Setup.
- Kennzahlen: DPS, Schaden pro Magazin, RPM-Diagramme, Top-Waffen-Ranking.

### 4.3 Gear-Inventar

- Sechs Slots: Maske, Weste, Holster, Rucksack, Handschuhe, Knieschoner.
- Marke/Set, Kernattribut, Nebenattribute, Mods, Talent, Prototyp-Kennzeichen.
- Unterstützung von Named-/Exotic-Gear sowie Brand-Set- und Gear-Set-Boni (2er/3er/4er).

### 4.4 Optimierung

- Berechnung der besten Kombination aus Inventar-Waffen und Gear nach wählbarem Ziel (z. B. maximaler Waffenschaden, Crit-Balance, Panzerung).
- Nebenbedingungen: Pflicht-Teile, ausgeschlossene Teile, Exotic-Limit (max. ein Exotic-Gear, eine Exotic-Waffe), Attribut-Obergrenzen (z. B. CHC-Cap 60 %).
- Ergebnisliste der besten N Builds mit Begründung der Werte.
- Berechnung im Hintergrund mit Fortschrittsanzeige und Abbruchmöglichkeit.

### 4.5 Vergleich

- Waffenvergleich (zwei oder mehr Waffen nebeneinander, Diagramme).
- Set-Vergleich (Brand-Sets / Gear-Sets im direkten Gegenüber).
- Gespeicherte Builds als „Loadouts" vergleichen.

### 4.6 Waffen & Ausrüstung (DB)

- Editierbare Tabellen für die Spiel-Basisdaten: Waffen, Waffentalente, Gear, Gear-Talente, Brand-Sets, Gear-Sets und Mods (Hinzufügen, Bearbeiten, Löschen pro Eintrag).
- Änderungen wirken unabhängig vom Inventar des Spielers und werden lokal beim Spieler im selben Datenverzeichnis wie das Inventar als Override gespeichert; die Standarddaten (JSON im App-Paket) bleiben unangetastet.
- „Alle Anpassungen zurücksetzen" stellt die Standarddaten wieder her; Versionsanzeige der Datenbanken und Zähler der eigenen Anpassungen.

### 4.7 Import / Export

- Import von CSV und Excel (.xlsx) anhand der bestehenden Vorlagen (Semikolon-CSV, gleiche Spalten).
- Export von Inventar und Builds als Datei (JSON/CSV) sowie Build-Code zum Teilen (Zwischenablage).
- Übernahme vorhandener Daten aus der Web-Version (Export-Datei des localStorage, Schema v17).

### 4.8 Einstellungen

- Sprache (DE/EN), Design (hell/dunkel/System), Zahlenformat.
- Speicherort der Benutzerdaten, automatische Sicherungen.
- Update-Prüfung (optional, abschaltbar).

## 5. Bedienoberfläche (Redesign)

Leitbild: Windows-11-typisch (Fluent Design), dunkles Standard-Design in Anlehnung an die Spielästhetik mit Akzentfarbe Orange (SHD-Orange).

Aufbau des Hauptfensters:

```
+--------------------------------------------------------------+
| Titelleiste  [Profil v]  [Suche]                  _  []  X   |
+--------+-------------------------------------+---------------+
| Navi   |                                     | Build-Werte   |
| Global |        Arbeitsbereich               | CHC / CHD /WD |
| Waffen |  (Tabelle, Formular, Diagramm)      | DPS, Panzerung|
| Gear   |                                     | Set-Boni      |
| Optim. |                                     |               |
| Vergl. |                                     |               |
| Admin  |                                     |               |
| Einst. |                                     |               |
+--------+-------------------------------------+---------------+
| Statuszeile: Datenbank-Version · Speicherstatus · Fortschritt |
+--------------------------------------------------------------+
```

- Linke Navigationsleiste ersetzt die horizontale Reiterleiste.
- Rechte, einklappbare Werte-Leiste zeigt jederzeit die aktuellen Build-Werte.
- Bearbeitung in Seitenpaneelen statt Popups; Doppelklick in Tabellen öffnet den Editor.
- Tastaturkürzel: Strg+N (neu), Strg+S (speichern), Strg+F (suchen), F5 (optimieren), Entf (löschen), Strg+Z (rückgängig).
- Drag & Drop von CSV/XLSX-Dateien ins Fenster zum Import.
- Mindestauflösung 1280 × 720, skaliert sauber bei 125–200 % Windows-Skalierung.
- Fenstergröße und -position werden gemerkt.

## 6. Nicht-funktionale Anforderungen

| Kategorie | Anforderung |
| --- | --- |
| Plattform | Windows 10 (22H2) und Windows 11, 64 Bit |
| Start | Kaltstart unter 3 Sekunden |
| Leistung | Optimierungslauf mit üblichem Inventar (ca. 50 Waffen, 150 Gear-Teile) unter 10 Sekunden, Oberfläche bleibt bedienbar |
| Offline | Volle Funktion ohne Internet |
| Datensicherheit | Speicherung unter `%APPDATA%\D2BuildOptimizer`, automatische Sicherung, Wiederherstellung beschädigter Einträge |
| Barrierefreiheit | Tastaturbedienung, Screenreader-Beschriftungen, ausreichende Kontraste |
| Lokalisierung | Alle Texte in Sprachdateien, DE und EN |
| Wartbarkeit | Berechnungskern als eigenständiges, testbares Modul getrennt von der Oberfläche |
| Qualität | Bestehende Referenzwert-Tests bleiben gültig und laufen in der CI |
| Datenschutz | Keine Telemetrie ohne Zustimmung; keine Konto-Pflicht |

## 7. Technische Architektur (Vorschlag)

### 7.1 Empfohlene Variante: Tauri 2 (alternativ Electron)

Die vorhandene JavaScript-Logik und die JSON-Daten können weitgehend übernommen werden; die Oberfläche wird neu gestaltet.

```
+-------------------------------------------+
| Oberfläche (React/TypeScript + Fluent UI) |
+-------------------------------------------+
| Anwendungsschicht: Zustand, Undo/Redo,    |
| Import/Export, Validierung                |
+-------------------------------------------+
| Berechnungskern (TypeScript, aus app.js / |
| app2.js extrahiert) – im Web Worker       |
+-------------------------------------------+
| Datenschicht: Standard-DBs (JSON, mit-    |
| geliefert) + Benutzerdaten (SQLite)       |
+-------------------------------------------+
| Desktop-Hülle (Tauri/Rust bzw. Electron): |
| Dateizugriff, Fenster, Updates, Installer |
+-------------------------------------------+
```

| Kriterium | Tauri 2 | Electron | WinUI 3 / .NET |
| --- | --- | --- | --- |
| Wiederverwendung JS-Code | hoch | hoch | gering (Neuschreiben in C#) |
| Installationsgröße | ca. 10 MB | ca. 100 MB | ca. 30–60 MB |
| Native Windows-Optik | gut (mit Fluent UI) | gut | sehr gut |
| Aufwand | mittel | gering | hoch |

### 7.2 Datenmodell (Kern)

- **Waffe:** Name, Typ, Seltenheit, Named/Exotic/Replica, Basiswerte, Slot-Typen für Mods, Talent, Hinweis.
- **Gear-Teil:** Slot, Marke/Set, Klasse, Kernattribut + Wert, feste und freie Attribute, Mods, Talent, Prototyp.
- **Mod:** Kategorie (Optik/Mündung/Unterlauf/Magazin), kompatible Slot-Typen bzw. Kaliber, Werte.
- **Talent:** Name, Kategorie, Wirkung, Stack-Parameter.
- **Set-Info:** Brand-Set-Boni (PvE-Werte der Saison), Gear-Set-Boni (2p/3p/4p).
- **Build/Loadout:** Referenzen auf Waffen und Gear, Ergebniswerte, Notiz, Zeitstempel.

Alle Standard-Datenbanken tragen eine Versionskennung (z. B. `gear_v1`, `mods_v1`); Benutzerdaten haben ein eigenes, migrierbares Schema.

### 7.3 Aktualisierung der Spieldaten

- Standard-Datenbanken werden mit jeder App-Version ausgeliefert.
- Optional: Download aktualisierter Datenpakete (signiert) aus dem GitHub-Repository, ohne App-Update.

## 8. Installation und Verteilung

- Installer als MSI/MSIX bzw. NSIS-Setup, zusätzlich portable ZIP-Version.
- Code-Signatur zur Vermeidung von SmartScreen-Warnungen.
- Automatische Updates über GitHub Releases (abschaltbar).
- Deinstallation entfernt Programmdateien; Benutzerdaten bleiben auf Wunsch erhalten.

## 9. Migration aus der Web-Version

1. In der Web-Version „Daten exportieren" ergänzen (localStorage → JSON-Datei).
2. Die Windows-App erkennt beim ersten Start die Datei bzw. bietet den Import an.
3. Migration über die bestehende Schema-Migration (v17) in das neue Format.
4. Web-Version bleibt parallel über GitHub Pages verfügbar (gemeinsamer Berechnungskern).

## 10. Vorgehen in MVP-Stufen

**Grundsatz:** Zuerst entsteht die vollständige Bedienoberfläche (GUI) als lauffähige Windows-App mit Beispieldaten. Die fachlichen Funktionen (Berechnung, Optimierung, Datenpflege) werden danach Schritt für Schritt nachgebaut bzw. neu gebaut und an die fertige Oberfläche angeschlossen. So lässt sich das Bedienkonzept früh testen und abstimmen, bevor Aufwand in die Logik fließt.

> **Review-Korrektur 2026-10:** Die Berechnung ist der fachlich unsichere Teil — sie bestimmt Datenmodell und Eingabemasken (Felder eines Gear-Teils, Talent-Stacks, Bonus-Kategorien). Daher wird **MVP 0 (Berechnungskern) vor MVP 1.0** gesetzt: Der Berechnungskern entsteht als reines TypeScript-Modul mit Unit- und Referenztests, ohne Oberfläche. Die GUI wird danach auf dem dabei entstandenen, getesteten Datenmodell aufgebaut. MVP 1.0 (GUI-Prototyp) bleibt unverändert inhaltlich, baut aber auf dem fertigen Datenmodell auf.

### MVP 0 – Berechnungskern (reines TS-Modul mit Tests)

- Schadensformel als eigenes Modul (`src/data/damage.ts`), ohne GUI-Abhängigkeiten: Bonus-Kategorien additiv innerhalb, multiplikativ zwischen den Gruppen — dokumentiert in `docs/FORMELN.md` (siehe Issue #63).
- Unit-Tests für `aggregateBuild`/`computeDamage` (vitest) plus Referenztests: (a) Parität mit der Web-Version, (b) **Spiel-Referenzwerte** aus Screenshots bekannter Builds (Issue #62) — bekannte Abweichungen werden dokumentiert, nicht versteckt.
- Optimierungs\-Zielfunktion: ein Hauptziel (z. B. DPS) mit Mindestwerten; Überschuss über Caps wird bestraft (Issue #64).
- Performance-Konzept für große Inventare: Dominanz-Vorfilterung + Pruning statt Brute-Force-Cap (Issue #61); Benchmark mit ~150 Teilen.
- SHD-Watch-Verteilung: vorgegeben (nicht mitoptimiert), als Annahme im Ergebnis ausgewiesen.

**Abnahme:** Tests grün in CI; Formeldokument reviewt; Benchmark-Ziel erreicht.

### MVP 1.0 – GUI-Prototyp (klickbare Oberfläche)

**Ziel:** Die App sieht aus und lässt sich bedienen wie das Endprodukt; Werte sind noch Platzhalter.

- Desktop-Grundgerüst (Tauri/Electron) mit Installer bzw. portabler Version, Start per Doppelklick.
- Hauptfenster mit Titelleiste, linker Navigation, Arbeitsbereich, rechter Werte-Leiste und Statuszeile.
- Alle Ansichten als Masken angelegt: Global, Waffen, Gear, Optimierung, Vergleich, Set-Vergleich, Admin, Einstellungen.
- Tabellen mit Filter/Sortierung, Seitenpaneele zum Bearbeiten, Dialoge, Diagramm-Platzhalter.
- Anzeige der mitgelieferten JSON-Daten (nur lesend) bzw. statischer Beispieldaten.
- Design-System: dunkles/helles Design, Akzentfarbe, Schriften, Symbole, Skalierung 125–200 %.
- Grundlegende Tastaturbedienung und Fenster-Zustand merken.
- Sprachgerüst DE (EN vorbereitet).

**Nicht enthalten:** echte Berechnungen, Optimierung, dauerhafte Speicherung, Import/Export.
**Abnahme:** Alle Ansichten erreichbar, Bedienkonzept mit Testnutzern abgestimmt, App installiert und startet auf Windows 10/11.

### MVP 1.1 – Datenhaltung und Inventar

- Dauerhafte Speicherung der Benutzerdaten (SQLite unter `%APPDATA%`), automatische Sicherung.
- Waffen- und Gear-Inventar voll funktionsfähig: anlegen, bearbeiten, löschen, Vorbelegung aus der Datenbank.
- Mehrere Profile/Loadouts speichern und laden.
- Rückgängig/Wiederholen.

### MVP 1.2 – Berechnungskern

- Berechnungslogik aus `app.js`/`app2.js` herauslösen, als eigenes Modul neu aufbauen bzw. übernehmen.
- Übernahme der bestehenden Referenzwert-Tests; Abweichungen zur Web-Version = 0 **plus** Spiel-Referenzwerte aus MVP 0 (Issue #62). Parität mit der Web-Version übernimmt deren Fehler nicht kommentarlos: bekannte Web-Bugs werden als dokumentierte, tolerierte Abweichungen geführt.
- Live-Werte in der Werte-Leiste (CHC, CHD, WD, DPS, Panzerung, Set-Boni).
- Talente inkl. Exotic-Talente mit Stack-Reglern, automatische Mod-Auswahl.

### MVP 1.3 – Optimierung und Vergleich

- Build-Optimierung im Hintergrund mit Fortschritt und Abbruch.
- Ziele und Nebenbedingungen (Pflichtteile, Exotic-Limit, Caps).
- Waffen-, Set- und Loadout-Vergleich mit echten Diagrammen (RPM, DPS, Top-Ranking).

### MVP 1.4 – Import/Export und Migration

- CSV-/XLSX-Import nach den bestehenden Vorlagen, Drag & Drop.
- Export als JSON/CSV, Build-Code zum Teilen.
- Übernahme der Daten aus der Web-Version (Schema v17).

### MVP 1.5 – Admin und Datenpflege

- Tabellen-Editor für Waffen-, Gear-, Brand-, Gear-Set- und Mod-Datenbank mit Validierung.
- Trennung Standarddaten / Benutzeranpassungen, Zurücksetzen.
- Optional: Download signierter Datenpakete für neue Spielsaisons.

### Version 2.0 – Release

- Englische Übersetzung vollständig, Barrierefreiheit geprüft.
- Code-Signatur, Auto-Update über GitHub Releases.
- Leistungsoptimierung, öffentlicher Beta-Test, Fehlerbehebung, Dokumentation/Hilfe.

### Übersicht

| Stufe | Schwerpunkt | Ergebnis |
| --- | --- | --- |
| MVP 1.0 | GUI | Klickbarer Prototyp als Windows-App |
| MVP 1.1 | Daten | Inventar dauerhaft nutzbar |
| MVP 1.2 | Berechnung | Korrekte Werte wie in der Web-Version |
| MVP 1.3 | Optimierung | Beste Builds finden und vergleichen |
| MVP 1.4 | Import/Export | Datenaustausch und Umstieg von Web |
| MVP 1.5 | Admin | Spieldaten selbst pflegen |
| 2.0 | Release | Fertiges, signiertes Produkt |

Jede Stufe endet mit einer installierbaren Version und einer kurzen Abnahme, bevor die nächste beginnt.

## 11. Abgrenzung

- Kein Auslesen von Spieldaten aus dem Spiel oder Ubisoft-Konten (kein Eingriff in den Spielclient).
- Keine Mehrspieler- oder Cloud-Funktionen in Version 1.
- Keine macOS-/Linux-Version in Version 1 (technisch mit Tauri/Electron später möglich).

## 12. Rechtlicher Hinweis

The Division 2 ist eine Marke von Ubisoft Entertainment. Die Anwendung ist ein Fan-Werkzeug und steht in keiner Verbindung zu Ubisoft. Spielgrafiken und Logos werden nicht verwendet.
