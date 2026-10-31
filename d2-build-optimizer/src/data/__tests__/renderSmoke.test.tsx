import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import * as React from "react";
import { OptimizerView } from "../../views/OptimizerView";
import { OnboardingWizard } from "../../components/OnboardingWizard";
import { DashboardView } from "../../views/DashboardView";
import { LoadoutsView } from "../../views/LoadoutsView";
import { BuildsView } from "../../views/BuildsView";
import App from "../../App";
import { StoreProvider } from "../../store";

describe("OptimizerView Render-Smoke (Fix schwarzer Bildschirm)", () => {
  it("rendert ohne Laufzeitfehler (initiale Hooks-Reihenfolge, TDZ)", () => {
    const html = renderToString(
      React.createElement(StoreProvider, null, React.createElement(OptimizerView)),
    );
    expect(html).toContain("Build-Optimierung V4");
    expect(html).toContain("DPS");
    expect(html).toContain("Fragebogen");
    expect(html).toContain("Spezialisierungs-Vorschlag");
  });

  it("rendert Fragebogen-Optionen und Skill-Auswahl", () => {
    const html = renderToString(
      React.createElement(StoreProvider, null, React.createElement(OptimizerView)),
    );
    expect(html).toContain("Teamgröße");
    expect(html).toContain("Skills (2 Plätze)");
    expect(html).toContain("Noch keine Gear-Teile erfasst");
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
