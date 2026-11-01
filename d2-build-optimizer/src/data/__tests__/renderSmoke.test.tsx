import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import * as React from "react";
import { OptimizerView } from "../../views/OptimizerView";
import { OnboardingWizard } from "../../components/OnboardingWizard";
import { DashboardView } from "../../views/DashboardView";
import { LoadoutsView } from "../../views/LoadoutsView";
import { BuildsView } from "../../views/BuildsView";
import { WeaponsView } from "../../views/WeaponsView";
import { SettingsView } from "../../views/SettingsView";
import App from "../../App";
import { StoreProvider } from "../../store";

describe("OptimizerView Render-Smoke (Fix schwarzer Bildschirm)", () => {
  it("rendert ohne Laufzeitfehler (initiale Hooks-Reihenfolge, TDZ)", () => {
    const html = renderToString(
      React.createElement(StoreProvider, null, React.createElement(OptimizerView)),
    );
    expect(html).toContain("Build-Optimierung V4");
    expect(html).toContain("DPS");
    expect(html).toContain("Rolle w\u00e4hlen");
    expect(html).toContain("Rahmen anpassen");
  });

  it("rendert Inventar-Status und Rollen (Wizard Schritt 1)", () => {
    const html = renderToString(
      React.createElement(StoreProvider, null, React.createElement(OptimizerView)),
    );
    expect(html).toContain("Inventar-Status");
    expect(html).toContain("DPS Krit");
    expect(html).not.toContain("Zielmetrik");
  });
});

describe("OnboardingWizard Render-Smoke (TRA-4, Issue #119)", () => {
  it("rendert die drei Schritte mit SHD-Eingabe und Import-Buttons", () => {
    const html = renderToString(
      React.createElement(StoreProvider, null, React.createElement(OnboardingWizard)),
    );
    expect(html).toContain("Ersteinrichtung in unter 3 Minuten");
    expect(html).toContain("SHD-Level");
    expect(html).toContain("Spezialisierung");
    expect(html).toContain("1 · Charakter");
    expect(html).toContain("2 · Inventar importieren");
    expect(html).toContain("3 · Erstes Ergebnis");
    expect(html).toContain("Überspringen");
    expect(html).toContain("Weiter");
  });
});

describe("DashboardView Render-Smoke (Lastenheft Dashboard)", () => {
  it("rendert KPI-Kacheln, Schnellaktionen und Datenstatus", () => {
    const html = renderToString(
      React.createElement(StoreProvider, null, React.createElement(DashboardView)),
    );
    expect(html).toContain("Dashboard");
    expect(html).toContain("Inventar-Überblick");
    expect(html).toContain("Gear-Teile");
    expect(html).toContain("Safe-to-Junk");
    expect(html).toContain("Lückenanalyse");
    expect(html).toContain("Deine Builds &amp; Loadouts");
    expect(html).toContain("Schnellaktionen");
    expect(html).toContain("Zustand der Daten");
    expect(html).toContain("Optimierer starten");
    expect(html).toContain("Build-Tipp");
  });
});

describe("LoadoutsView + Nav-Gruppen (Nav-Relaunch)", () => {
  it("rendert die Loadouts-Tabelle mit allen Werte-Spalten", () => {
    const html = renderToString(
      React.createElement(StoreProvider, null, React.createElement(LoadoutsView)),
    );
    expect(html).toContain("Loadouts");
    expect(html).toContain("Name");
    expect(html).toContain("Rolle");
    expect(html).toContain("DPS");
    expect(html).toContain("CHC");
    expect(html).toContain("CHD");
    expect(html).toContain("Rüstung");
    expect(html).toContain("Gespeichert");
    expect(html).toContain("Zuletzt gespeichert");
  });

  it("Nav zeigt Gruppen-Header im PowerToys-Stil", () => {
    const html = renderToString(React.createElement(StoreProvider, null, React.createElement(App)));
    expect(html).toContain("nav-group-title");
    expect(html).toContain("Inventar");
    expect(html).toContain("Optimierung");
    expect(html).toContain("Einstellungen");
    expect(html).toContain("Loadouts");
    expect(html).toContain("Startseite");
  });
});

describe("BuildsView (manuelle Build-Erfassung)", () => {
  it("rendert Waffen-Auswahl, sechs Slot-Auswahlen und Speichern-Button", () => {
    const html = renderToString(
      React.createElement(StoreProvider, null, React.createElement(BuildsView)),
    );
    expect(html).toContain("Eigenen Build zusammenstellen");
    expect(html).toContain("Waffe");
    expect(html).toContain("Maske");
    expect(html).toContain("Weste");
    expect(html).toContain("Knieschoner");
    expect(html).toContain("Build als Loadout speichern");
    expect(html).toContain("Zurücksetzen");
  });

  it("erscheint im Nav unter Inventar nach Gear", () => {
    const html = renderToString(React.createElement(StoreProvider, null, React.createElement(App)));
    expect(html).toContain("Builds");
  });
});

describe("BuildsView mit Picker-Kacheln", () => {
  it("rendert Kacheln mit Auswahl-Hinweis statt Dropdowns", () => {
    const html = renderToString(
      React.createElement(StoreProvider, null, React.createElement(BuildsView)),
    );
    expect(html.replace(/<!-- -->/g, "")).toContain("＋ Waffe auswählen");
    expect(html.replace(/<!-- -->/g, "")).toContain("＋ Maske auswählen");
    expect(html.replace(/<!-- -->/g, "")).toContain("＋ Knieschoner auswählen");
  });
});

describe("Waffen-Bearbeitung: Mod-Plätze (Mods am Build)", () => {
  it("WeaponsView-Tabelle bleibt ohne Mod-Spalte (Inventar mod-frei)", () => {
    const html = renderToString(
      React.createElement(StoreProvider, null, React.createElement(WeaponsView)),
    );
    expect(html).toContain("Know-How");
    expect(html).not.toContain("montierte Waffen-Mods");
  });
});

describe("OptimizerView Wizard (Progress Bar)", () => {
  it("rendert die 3 Schritt-Knoten mit Labels", () => {
    const html = renderToString(
      React.createElement(StoreProvider, null, React.createElement(OptimizerView)),
    );
    expect(html).toContain("wizard-progress");
    expect(html).toContain("Rolle w\u00e4hlen");
    expect(html).toContain("Rahmen anpassen");
    expect(html).toContain("Berechnen");
  });

  it("Schritt 1 ist aktiv, Schritt-2-Sektionen sind ausgeblendet", () => {
    const html = renderToString(
      React.createElement(StoreProvider, null, React.createElement(OptimizerView)),
    );
    expect(html).not.toContain("Fragebogen (optional");
    expect(html).not.toContain("Zielmetrik");
    expect(html).not.toContain("Einschr\u00e4nkungen (optional)");
  });
});

describe("SettingsView im Windows-Stil (zweispaltig)", () => {
  it("rendert Tabs und Sprachauswahl im Darstellungs-Bereich (Einheitsformat)", () => {
    const html = renderToString(
      React.createElement(StoreProvider, null, React.createElement(SettingsView)),
    );
    expect(html).toContain('class=\"tabs\"');
    expect(html).toContain("Darstellung");
    expect(html).toContain("Sprache");
    expect(html).toContain("Deutsch");
    expect(html).toContain("English");
  });

  it("weitere Kategorien (Daten, Updates, Über) sind als Tabs vorhanden", () => {
    const html = renderToString(
      React.createElement(StoreProvider, null, React.createElement(SettingsView)),
    );
    expect(html).toContain("Daten &amp; Speicherung");
    expect(html).toContain("Updates");
    expect(html).toContain("Über");
  });
});
