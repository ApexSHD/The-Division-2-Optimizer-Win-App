import { describe, it, expect } from "vitest";
import { sanitize } from "../../store";

describe("Blackscreen-Fix: Alte Benutzerdaten (Build-Format vor PR #122/#126)", () => {
  it("alte Builds ohne metrics/roleId/dbVersion werden zu neutralen Loadouts aufgefuellt", () => {
    const legacy = {
      schemaVersion: 1,
      profiles: [{ id: "default", name: "Standard" }],
      activeProfileId: "default",
      theme: "dark",
      lang: "de",
      agent: { shdLevel: 1000, spec: "sharpshooter", mode: "pve", season: "y8s3" },
      weapons: [],
      gear: [],
      builds: [
        {
          id: "b1",
          name: "Alter Build",
          weaponIds: ["w1"],
          gearIds: { mask: "g1" },
          note: "aus alter Version",
          timestamp: "2026-10-01T00:00:00.000Z",
        },
      ],
      activeBuildId: "b1",
    };
    const data = sanitize(legacy);
    expect(data.builds).toHaveLength(1);
    const b = data.builds[0];
    expect(b.metrics.dps).toBe(0);
    expect(b.metrics.chc).toBe(0);
    expect(b.roleId).toBe("");
    expect(b.dbVersion).toBe("");
    expect(b.weaponIds).toEqual(["w1"]);
    expect(b.gearIds).toEqual({ mask: "g1" });
  });

  it("kaputte Build-Eintraege (ohne id, falsche Typen) werden verworfen", () => {
    const legacy = {
      profiles: [{ id: "default", name: "Standard" }],
      builds: [
        null,
        { name: "ohne id" },
        { id: "ok", weaponIds: "kein-array", gearIds: null, metrics: "kaputt" },
        "string-eintrag",
      ],
    };
    const data = sanitize(legacy);
    expect(data.builds).toHaveLength(1);
    expect(data.builds[0].id).toBe("ok");
    expect(data.builds[0].weaponIds).toEqual([]);
    expect(data.builds[0].metrics.dps).toBe(0);
  });

  it("neuere Loadouts mit metrics bleiben unveraendert", () => {
    const modern = {
      profiles: [{ id: "default", name: "Standard" }],
      builds: [
        {
          id: "b2",
          name: "Neu",
          weaponIds: ["w2"],
          gearIds: { chest: "g2" },
          note: "",
          timestamp: "2026-10-31T00:00:00.000Z",
          roleId: "dps_krit",
          assumptions: ["Gear-Mods: Max-Roll angenommen"],
          metrics: { dps: 123456, chc: 54.9, chd: 123, wd: 40, hsd: 25, armor: 200000 },
          dbVersion: "weapons_v1 · gear_v1 · mods_v1",
          signatures: { w2: "sig", g2: "sig" },
        },
      ],
    };
    const data = sanitize(modern);
    expect(data.builds[0].metrics.dps).toBe(123456);
    expect(data.builds[0].signatures?.w2).toBe("sig");
    expect(data.builds[0].roleId).toBe("dps_krit");
  });
});
