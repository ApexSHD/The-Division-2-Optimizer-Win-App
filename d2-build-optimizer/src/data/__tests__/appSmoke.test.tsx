import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import * as React from "react";
import App from "../../App";

declare global {
  interface Window { __userData?: unknown }
}

describe("App-Start (schwarzer Bildschirm Regression)", () => {
  it("rendert die komplette Shell inkl. Navigation", () => {
    const html = renderToString(React.createElement(App));
    expect(html).toContain("Dashboard");
    expect(html).toContain("nav");
  });
});
