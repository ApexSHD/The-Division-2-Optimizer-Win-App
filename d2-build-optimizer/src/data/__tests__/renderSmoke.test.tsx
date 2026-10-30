import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import * as React from "react";
import { OptimizerView } from "../../views/OptimizerView";
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
    expect(html).toContain("Kein Inventar erfasst");
  });
});
