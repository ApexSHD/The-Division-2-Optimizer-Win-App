import { useMemo, useState } from "react";
import { useStore } from "../store";
import {
  evaluateBuild,
  enemyProfileFromSettings,
  type SetBonusCatalog,
} from "../data/damage";
import { computeEffectVector, type AxisContext } from "../data/axes";
import { DB_VERSION } from "../data/sampleData";
import type { Weapon, GearPiece, GearSlot, Loadout } from "../data/sampleData";
import { gearFingerprint, weaponFingerprint } from "../data/loadoutIntegrity";
import gearJson from "../db/gear.json";
import modsJson from "../db/mod.json";

const SLOTS: GearSlot[] = ["mask", "chest", "holster", "backpack", "gloves", "kneepads"];

const SLOT_LABELS: Record<GearSlot, string> = {
  mask: "Maske",
  chest: "Weste",
  holster: "Holster",
  backpack: "Rucksack",
  gloves: "Handschuhe",
  kneepads: "Knieschoner",
};

function defaultSetBonusCatalog(): SetBonusCatalog {
  const gearDb = gearJson as unknown as {
    brand_set_info: Record<string, Record<string, unknown>>;
    green_set_info: Record<string, Record<string, unknown>>;
  };
  const brands: SetBonusCatalog["brands"] = {};
  for (const [key, info] of Object.entries(gearDb.brand_set_info ?? {})) {
    brands[key.toLowerCase()] = (info as { bonuses_pve?: Record<string, Record<string, unknown>> }).bonuses_pve ?? {};
  }
  const greens: SetBonusCatalog["greens"] = {};
  for (const [key, info] of Object.entries(gearDb.green_set_info ?? {})) {
    greens[key.toLowerCase()] = (info as { bonuses?: Record<string, { attr: string; val: number }[]> }).bonuses ?? {};
  }
  return { brands, greens };
}

export function BuildsView() {
  const store = useStore();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [weaponId, setWeaponId] = useState<string>("");
  const [slotIds, setSlotIds] = useState<Partial<Record<GearSlot, string>>>({});

  const weapon: Weapon | null = store.weapons.find((w) => w.id === weaponId) ?? null;
  const gear: GearPiece[] = SLOTS.map((s) => store.gear.find((g) => g.id === slotIds[s])).filter(
    (g): g is GearPiece => Boolean(g),
  );

  const preview = useMemo(() => {
    if (!weapon || gear.length === 0) return null;
    const modsBySlot = (modsJson as unknown as {
      slots: Record<string, Array<{ name: string; slotTypes: string[]; bonus: { type: string; val: number } | null; penalty?: { type: string; val: number } | null }>>;
    }).slots;
    const ctx = {
      shdLevel: store.agent.shdLevel,
      profile: enemyProfileFromSettings(store.optimization),
      spec: store.agent.spec,
      modsBySlot,
      setBonusCatalog: defaultSetBonusCatalog(),
    };
    const { stats, damage } = evaluateBuild(weapon, gear, ctx);
    const axisCtx: AxisContext = {
      weaponDps: damage.effectiveDps,
      gear,
      skills: [],
      teamSize: 4,
      threat: { statusShare: 0.3 },
      specializationKey: ctx.spec,
    };
    const vector = computeEffectVector(axisCtx);
    return { stats, damage, ehp: vector.ehp };
  }, [weapon, gear, store.agent.shdLevel, store.agent.spec, store.optimization]);

  const exoticCount = gear.filter((g) => g.brandType === "exotic").length;
  const exoticWeapon = weapon?.rarity === "exotic" ? 1 : 0;
  const exoticWarning =
    exoticCount + exoticWeapon > 1
      ? `Exotic-Limit: ${exoticCount} Exotic-Gear-Teil(e) + ${exoticWeapon} Exotic-Waffe — im Spiel ist nur EIN Exotic insgesamt erlaubt.`
      : null;

  const save = () => {
    if (!weapon) {
      store.setStatus("Bitte eine Waffe auswählen.");
      return;
    }
    if (gear.length === 0) {
      store.setStatus("Bitte mindestens ein Gear-Teil auswählen.");
      return;
    }
    const loadoutName =
      name.trim() || `${weapon.name} — ${new Date().toLocaleDateString("de-DE")}`;
    const gearIds: Partial<Record<GearSlot, string>> = {};
    for (const g of gear) gearIds[g.slot] = g.id;
    const loadout: Loadout = {
      id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: loadoutName,
      weaponIds: [weapon.id],
      gearIds,
      note: note.trim() || "Manuell zusammengestellt",
      timestamp: new Date().toISOString(),
      roleId: "",
      assumptions: ["Manuell erfasst — Kennzahlen live berechnet"],
      metrics: preview
        ? {
            dps:
              store.optimization.targetMetric === "burst"
                ? preview.damage.effectiveDps
                : preview.damage.sustainedDps,
            chc: preview.stats.chc,
            chd: preview.stats.chd,
            wd: preview.stats.wd,
            hsd: preview.stats.hsd,
            armor: preview.ehp,
          }
        : { dps: 0, chc: 0, chd: 0, wd: 0, hsd: 0, armor: 0 },
      dbVersion: DB_VERSION,
      signatures: {
        [weapon.id]: weaponFingerprint(weapon),
        ...Object.fromEntries(gear.map((g) => [g.id, gearFingerprint(g)])),
      },
    };
    store.addBuild(loadout);
    store.setActiveBuildId(loadout.id);
    store.setStatus(`„${loadoutName}" gespeichert und als aktuell getragen festgelegt`);
    setName("");
    setNote("");
    setWeaponId("");
    setSlotIds({});
  };

  const metricsRows: Array<[string, string]> = preview
    ? [
        ["DPS (Burst)", Math.round(preview.damage.effectiveDps).toLocaleString("de-DE")],
        ["DPS (Dauer)", Math.round(preview.damage.sustainedDps).toLocaleString("de-DE")],
        ["CHC", `${Math.min(60, preview.stats.chc).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`],
        ["CHD", `+${preview.stats.chd.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`],
        ["WD", `+${preview.stats.wd.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`],
        ["HSD", `+${preview.stats.hsd.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`],
        ["Rüstung (EHP)", Math.round(preview.ehp).toLocaleString("de-DE")],
      ]
    : [];

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <section className="field" style={{ margin: 0 }}>
        <h2 style={{ margin: 0 }}>Eigenen Build zusammenstellen</h2>
        <p style={{ margin: 0, color: "var(--text-dim, #aaa)", fontSize: 13 }}>
          Wähle eine Waffe und je Slot ein Gear-Teil aus deinem Inventar — die Kennzahlen werden
          live berechnet. Der Build wird als Loadout gespeichert und erscheinen in der
          Loadouts-Übersicht, im Vergleich und als „aktuell getragen".
        </p>
      </section>

      <section className="field" style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            Name (optional)
            <input
              type="text"
              placeholder="z. B. Mein Striker-Build"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: 220 }}
            />
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            Notiz (optional)
            <input
              type="text"
              placeholder="z. B. für Raids"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ width: 220 }}
            />
          </label>
        </div>
        <label style={{ display: "grid", gap: 4 }}>
          Waffe
          <select value={weaponId} onChange={(e) => setWeaponId(e.target.value)}>
            <option value="">— Waffe auswählen —</option>
            {[...store.weapons]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.type.toUpperCase()}
                  {w.rarity === "exotic" ? ", Exotic" : ""})
                </option>
              ))}
          </select>
        </label>
        {exoticWarning && (
          <div style={{ border: "1px solid var(--warn, #e6a23c)", borderRadius: 6, padding: "4px 8px", fontSize: 12, background: "rgba(230,162,60,0.08)" }}>
            ⚠ {exoticWarning}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
          {SLOTS.map((slot) => (
            <label key={slot} style={{ display: "grid", gap: 4, fontSize: 13 }}>
              {SLOT_LABELS[slot]}
              <select
                value={slotIds[slot] ?? ""}
                onChange={(e) =>
                  setSlotIds((prev) => ({ ...prev, [slot]: e.target.value || undefined }))
                }
              >
                <option value="">— frei lassen —</option>
                {store.gear
                  .filter((g) => g.slot === slot)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.brand}
                      {g.talent ? ` · ${g.talent}` : ""}
                      {g.brandType === "exotic" ? " (Exotic)" : ""}
                    </option>
                  ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      {preview && (
        <section className="field" style={{ display: "grid", gap: 8 }}>
          <strong>Live-Vorschau</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {metricsRows.map(([label, value]) => (
              <div key={label} style={{ border: "1px solid var(--border, #555)", borderRadius: 6, padding: "6px 10px", minWidth: 120 }}>
                <div style={{ fontSize: 11, color: "var(--text-dim, #aaa)" }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
          <small style={{ color: "var(--text-dim, #aaa)" }}>
            Berechnet mit den Rahmen-Einstellungen des Optimierers (Gegnerprofil, CHC-Ziel) und
            deiner Spezialisierung aus „Global". Gear-Mods: Max-Roll angenommen (siehe Annahmen).
          </small>
        </section>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn btn-accent" onClick={save} disabled={!weapon || gear.length === 0}>
          💾 Build als Loadout speichern
        </button>
        <button
          className="btn"
          onClick={() => {
            setName("");
            setNote("");
            setWeaponId("");
            setSlotIds({});
          }}
        >
          Zurücksetzen
        </button>
      </div>
    </div>
  );
}
