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
import { LoadoutsView } from "./LoadoutsView";
import { ItemPicker, type PickerTarget } from "../components/ItemPicker";
import { gearShortLabel, weaponShortLabel } from "../data/itemLabels";
import type { WeaponMod } from "../data/sampleData";

const GEAR_MOD_MAX: Record<string, number> = (() => {
  const db = modsJson as unknown as {
    gear_mods?: Record<string, Array<{ attr: string; val: number }>>;
  };
  const out: Record<string, number> = {};
  for (const list of Object.values(db.gear_mods ?? {})) {
    for (const m of list) out[m.attr] = m.val;
  }
  return out;
})();

const WEAPON_MODS_DB: Record<string, Array<{ name: string; label: string; bonusType: string; bonusVal: number; penaltyType?: string; penaltyVal?: number }>> = (() => {
  const db = modsJson as unknown as {
    slots?: Record<string, Array<{ name: string; bonus: { type: string; val: number } | null; penalty?: { type: string; val: number } | null }>>;
  };
  const out: Record<string, Array<{ name: string; label: string; bonusType: string; bonusVal: number; penaltyType?: string; penaltyVal?: number }>> = {};
  for (const [cat, list] of Object.entries(db.slots ?? {})) {
    out[cat] = (list ?? [])
      .filter((m) => m.bonus)
      .map((m) => ({
        name: m.name,
        label: `${m.name} (+${m.bonus!.val} % ${m.bonus!.type}${m.penalty ? ` / −${m.penalty.val} % ${m.penalty.type}` : ""})`,
        bonusType: m.bonus!.type,
        bonusVal: m.bonus!.val,
        penaltyType: m.penalty?.type,
        penaltyVal: m.penalty?.val,
      }));
  }
  return out;
})();

const MOD_SLOT_LABELS: Record<string, string> = {
  optic: "Optik",
  muzzle: "Mündung",
  underbarrel: "Unterlauf",
  magazine: "Magazin",
};
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
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [buildGearMods, setBuildGearMods] = useState<Record<string, { attr: string; value: number } | undefined>>({});
  const [buildWeaponMods, setBuildWeaponMods] = useState<WeaponMod[]>([]);

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
    const gearWithMods: GearPiece[] = gear.map((g) =>
      buildGearMods[g.id]
        ? ({ ...g, mod: { attr: buildGearMods[g.id]!.attr as import("../data/sampleData").GearAttrKey, value: buildGearMods[g.id]!.value } } as GearPiece)
        : ({ ...g, mod: null } as GearPiece),
    );
    const weaponWithMods: Weapon = { ...weapon, equippedMods: buildWeaponMods };
    const { stats, damage } = evaluateBuild(weaponWithMods, gearWithMods, ctx);
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
  }, [weapon, gear, buildGearMods, buildWeaponMods, store.agent.shdLevel, store.agent.spec, store.optimization]);

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
      gearMods: Object.fromEntries(
        Object.entries(buildGearMods).filter(([, v]) => Boolean(v)),
      ) as Loadout["gearMods"],
      weaponMods: buildWeaponMods.length > 0 ? buildWeaponMods : undefined,
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
        <div style={{ display: "grid", gap: 4 }}>
          <strong>Waffe</strong>
          <button
            className="btn"
            style={{
              textAlign: "left",
              padding: "8px 10px",
              border: `1px solid ${weapon ? "var(--accent, #f57c1f)" : "var(--border, #555)"}`,
              background: weapon ? "var(--accent-soft, rgba(245,124,31,0.16))" : undefined,
              minHeight: 44,
              display: "grid",
              gap: 2,
            }}
            onClick={() => setPicker({ kind: "weapon" })}
            title="Waffe aus dem Inventar auswählen"
          >
            {weapon ? (
              <>
                <span style={{ fontWeight: 600 }}>{weapon.name}</span>
                <span style={{ fontSize: 12, color: "var(--text-dim, #aaa)" }}>
                  {weaponShortLabel(weapon).split(" · ").slice(1).join(" · ")} · WD +{weapon.attributes.core1.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % · {weapon.rpm} RPM
                </span>
              </>
            ) : (
              <span>＋ Waffe auswählen…</span>
            )}
          </button>
        </div>
        {exoticWarning && (
          <div style={{ border: "1px solid var(--warn, #e6a23c)", borderRadius: 6, padding: "4px 8px", fontSize: 12, background: "rgba(230,162,60,0.08)" }}>
            ⚠ {exoticWarning}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
          {SLOTS.map((slot) => {
            const item = store.gear.find((g) => g.id === slotIds[slot]);
            return (
              <div key={slot} style={{ display: "grid", gap: 4 }}>
                <strong style={{ fontSize: 13 }}>{SLOT_LABELS[slot]}</strong>
                <button
                  className="btn"
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    border: item ? "1px solid var(--accent, #f57c1f)" : "1px dashed var(--border, #555)",
                    background: item ? "var(--accent-soft, rgba(245,124,31,0.16))" : undefined,
                    minHeight: 44,
                    display: "grid",
                    gap: 2,
                  }}
                  onClick={() => setPicker({ kind: "gear", slot })}
                  title="Gear-Teil aus dem Inventar auswählen"
                >
                  {item ? (
                    <>
                      <span style={{ fontWeight: 600 }}>
                        {item.brand}
                        {item.prototype ? " · Prototyp" : ""}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-dim, #aaa)" }}>
                        {gearShortLabel(item).split(" · ").slice(1).join(" · ")}
                      </span>
                    </>
                  ) : (
                    <span>＋ {SLOT_LABELS[slot]} auswählen…</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {(gear.some((g) => ["mask", "chest", "backpack"].includes(g.slot)) || (weapon && weapon.rarity !== "exotic" && weapon.modSlots.length > 0)) && (
        <section className="field" style={{ display: "grid", gap: 10 }}>
          <strong>Mod-Zuordnung für diesen Build</strong>
          {gear
            .filter((g) => ["mask", "chest", "backpack"].includes(g.slot))
            .map((g) => {
              const mod = buildGearMods[g.id];
              return (
                <div key={g.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                  <span style={{ minWidth: 220 }}>
                    {SLOT_LABELS[g.slot]}: <strong>{g.brand}</strong>
                  </span>
                  <select
                    value={mod?.attr ?? ""}
                    onChange={(e) => {
                      const attr = e.target.value;
                      if (!attr) {
                        setBuildGearMods((prev) => ({ ...prev, [g.id]: undefined }));
                        return;
                      }
                      const max = GEAR_MOD_MAX[attr] ?? 0;
                      setBuildGearMods((prev) => ({ ...prev, [g.id]: { attr, value: max } }));
                    }}
                  >
                    <option value="">– kein Mod –</option>
                    {Object.entries(GEAR_MOD_MAX).map(([attr, max]) => (
                      <option key={attr} value={attr}>
                        {attr.toUpperCase()} (Max {max.toLocaleString("de-DE")})
                      </option>
                    ))}
                  </select>
                  {mod && (
                    <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      Wert
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={mod.value}
                        onChange={(e) =>
                          setBuildGearMods((prev) => ({
                            ...prev,
                            [g.id]: { attr: mod.attr, value: Math.max(0, Number(e.target.value)) },
                          }))
                        }
                        style={{ width: 80 }}
                      />
                      <span style={{ color: "var(--text-dim, #aaa)", fontSize: 11 }}>
                        / Max {GEAR_MOD_MAX[mod.attr]?.toLocaleString("de-DE") ?? "?"}
                      </span>
                    </label>
                  )}
                </div>
              );
            })}
          {weapon && weapon.rarity !== "exotic" && weapon.modSlots.length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-dim, #aaa)" }}>
                Waffe: <strong>{weapon.name}</strong> ({weapon.modSlots.length} Mod-Platz/Plätze)
              </span>
              {weapon.modSlots.map((slot) => {
                const equipped = buildWeaponMods.find((m) => m.slot === slot);
                const pool = WEAPON_MODS_DB[slot] ?? [];
                return (
                  <div key={slot} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                    <span style={{ minWidth: 84 }}>{MOD_SLOT_LABELS[slot] ?? slot}</span>
                    <select
                      value={equipped?.dbName ?? ""}
                      onChange={(e) => {
                        const dbName = e.target.value;
                        const rest = buildWeaponMods.filter((m) => m.slot !== slot);
                        if (!dbName) {
                          setBuildWeaponMods(rest);
                          return;
                        }
                        const dbMod = pool.find((m) => m.name === dbName);
                        if (!dbMod) return;
                        setBuildWeaponMods([
                          ...rest,
                          {
                            slot,
                            attr: dbMod.bonusType as WeaponMod["attr"],
                            value: dbMod.bonusVal,
                            dbName,
                            reloadPenalty: dbMod.penaltyType === "reloadSpeed" ? dbMod.penaltyVal : undefined,
                          },
                        ]);
                      }}
                    >
                      <option value="">– kein Mod –</option>
                      {pool.map((m) => (
                        <option key={m.name} value={m.name}>{m.label}</option>
                      ))}
                    </select>
                    {equipped && (
                      <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        Wert
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={equipped.value}
                          onChange={(e) =>
                            setBuildWeaponMods((prev) =>
                              prev.map((m) =>
                                m.slot === slot ? { ...m, value: Math.max(0, Number(e.target.value)) } : m,
                              ),
                            )
                          }
                          style={{ width: 76 }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {weapon?.rarity === "exotic" && (
            <small style={{ color: "var(--text-dim, #aaa)" }}>
              Exotische Waffen haben feste Mods — keine Zuordnung möglich.
            </small>
          )}
          <small style={{ color: "var(--text-dim, #aaa)" }}>
            Gear-Mods werden mit dem Maximalwert aus der Mod-Datenbank vorbelegt und können
            reduziert werden. Waffen-Mod-Plätze entsprechen der Waffenspezifikation (Ansicht
            Waffen). Der Optimierer ordnet Mods automatisch je Rolle zu.
          </small>
        </section>
      )}

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
            setBuildGearMods({});
            setBuildWeaponMods([]);
          }}
        >
          Zurücksetzen
        </button>
      </div>

      <section className="field" style={{ margin: 0 }}>
        <h2 style={{ margin: "0 0 8px" }}>Vorhandene Loadouts</h2>
        <LoadoutsView embedded />
      </section>

      <ItemPicker
        open={picker !== null}
        target={picker ?? { kind: "weapon" }}
        selectedId={
          picker?.kind === "gear" ? (slotIds[picker.slot] ?? "") : weaponId
        }
        onPick={(id) => {
          if (!picker) return;
          if (picker.kind === "weapon") setWeaponId(id);
          else setSlotIds((prev) => ({ ...prev, [picker.slot]: id || undefined }));
        }}
        onClose={() => setPicker(null)}
      />
    </div>
  );
}
