import { useContext, useEffect, useState } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";
import { DataTable } from "../components/DataTable";
import type { Column } from "../components/DataTable";
import { SidePanel, Field } from "../components/SidePanel";
import { ChartPlaceholder } from "../components/ChartPlaceholder";
import { getDb } from "../data/db";
import type { WeaponPreset, TalentEntry } from "../data/db";
import type { Weapon, WeaponType, WeaponAttrKey } from "../data/sampleData";
import {
  WEAPON_ATTR_LABELS,
  WEAPON_CORE2_BY_TYPE,
  WEAPON_CORE1_MAX,
  WEAPON_MINOR_MAX,
  godRollAttributes,
  weaponAttrMax,
} from "../data/sampleData";

const ALL_MOD_SLOTS = ["optic", "muzzle", "underbarrel", "magazine"] as const;

function newWeapon(id: string): Weapon {
  return {
    id,
    name: "",
    type: "ar",
    rarity: "highend",
    baseDamage: 0,
    rpm: 0,
    magSize: 0,
    talent: "",
    modSlots: [...ALL_MOD_SLOTS],
    knowHow: 30,
    isPrototype: false,
    attributes: godRollAttributes("ar", false),
  };
}

export function WeaponsView() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Weapon | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [presets, setPresets] = useState<WeaponPreset[]>([]);
  const [talents, setTalents] = useState<TalentEntry[]>([]);

  useEffect(() => {
    getDb()
      .then((db) => {
        setPresets(db.weapons);
        setTalents(db.talents);
      })
      .catch(() => {
        setPresets([]);
        setTalents([]);
      });
  }, []);

  const presetsForType = (type: WeaponType) => presets.filter((p) => p.typeKey === type);
  const talentsForType = (type: WeaponType) => {
    const applicable = talents.filter((tal) => tal.weaponTypes.includes(type));
    const preset = presets.find((p) => p.name === editing?.name);
    const fixedTalent = preset?.talent ?? null;
    if (fixedTalent) {
      const known = applicable.some((tal) => tal.name === fixedTalent || tal.label === fixedTalent);
      if (!known) return [{ name: fixedTalent, label: fixedTalent } as TalentEntry, ...applicable];
    }
    return applicable;
  };

  function openEdit(w: Weapon) {
    setEditing(w);
    setIsNew(false);
    setPanelOpen(true);
  }

  function openNew() {
    setEditing(newWeapon(`w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`));
    setIsNew(true);
    setPanelOpen(true);
  }

  function applyPreset(p: WeaponPreset) {
    if (!editing) return;
    const slots = ALL_MOD_SLOTS.slice(0, p.modSlotCount);
    setEditing({
      ...editing,
      name: p.name,
      type: p.typeKey,
      rarity: p.isExotic ? "exotic" : p.isNamed ? "named" : "highend",
      baseDamage: p.baseDamage,
      rpm: p.rpm,
      magSize: p.magSize,
      talent: p.talent ?? "",
      note: p.note,
      modSlots: [...slots],
      isPrototype: !p.isExotic && p.isNamed,
      knowHow: 30,
      attributes: godRollAttributes(p.typeKey, !p.isExotic && p.isNamed),
    });
  }

  function onSave() {
    if (!editing) return;
    if (!editing.name.trim()) {
      store.setStatus(t.weapons.name + " fehlt");
      return;
    }
    if (isNew) store.addWeapon(editing);
    else store.updateWeapon(editing);
    setPanelOpen(false);
    store.setStatus(isNew ? `${editing.name} angelegt` : `${editing.name} gespeichert`);
  }

  function onDelete() {
    if (!editing || isNew) return;
    if (!confirm(`${editing.name} ${t.common.delete}?`)) return;
    store.removeWeapon(editing.id);
    setPanelOpen(false);
    store.setStatus(`${editing.name} gelöscht`);
  }

  const columns: Column<Weapon>[] = [
    {
      key: "name",
      label: t.weapons.columns.name,
      render: (w) => (
        <strong>
          {w.name}
          {w.isPrototype && <span className="badge gearset" style={{ marginLeft: 6 }}>Prototyp</span>}
        </strong>
      ),
      sortValue: (w) => w.name,
    },
    {
      key: "type",
      label: t.weapons.columns.type,
      render: (w) => t.weapons.types[w.type],
      sortValue: (w) => t.weapons.types[w.type],
    },
    {
      key: "rarity",
      label: t.weapons.columns.rarity,
      render: (w) => <span className={`badge ${w.rarity}`}>{t.weapons.rarities[w.rarity]}</span>,
      sortValue: (w) => w.rarity,
    },
    {
      key: "talent",
      label: t.weapons.columns.talent,
      render: (w) => w.talent,
    },
    {
      key: "dps",
      label: t.weapons.columns.dps,
      render: (w) => (w.baseDamage * w.rpm / 60).toLocaleString("de-DE", { maximumFractionDigits: 0 }),
      sortValue: (w) => (w.baseDamage * w.rpm) / 60,
    },
    {
      key: "dmgMag",
      label: t.weapons.columns.dmgMag,
      render: (w) => (w.baseDamage * w.magSize).toLocaleString("de-DE"),
      sortValue: (w) => w.baseDamage * w.magSize,
    },
    {
      key: "knowHow",
      label: "Know-How",
      render: (w) => `${w.knowHow}/30`,
      sortValue: (w) => w.knowHow,
    },
  ];

  return (
    <div>
      <DataTable
        rows={store.weapons}
        columns={columns}
        rowKey={(w) => w.id}
        searchPlaceholder={t.weapons.search}
        filterFn={(w, q) => w.name.toLowerCase().includes(q) || w.talent.toLowerCase().includes(q)}
        onRowDoubleClick={openEdit}
        toolbar={
          <button className="btn btn-accent" onClick={openNew}>
            + {t.weapons.new}
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
        <ChartPlaceholder label={`${t.compare.rpmChart} (RPM)`} />
        <ChartPlaceholder label={t.compare.topWeapons} />
      </div>

      <SidePanel
        open={panelOpen}
        title={editing && !isNew ? t.weapons.edit : t.weapons.new}
        onClose={() => setPanelOpen(false)}
        footer={
          <>
            {editing && !isNew && (
              <button className="btn btn-danger" onClick={onDelete}>{t.common.delete}</button>
            )}
            <span className="spacer" />
            <button className="btn" onClick={() => setPanelOpen(false)}>{t.common.cancel}</button>
            <button className="btn btn-accent" onClick={onSave}>{t.common.save}</button>
          </>
        }
      >
        {editing && (
          <>
            {!presets.some((p) => p.name === editing.name && p.typeKey === editing.type) && (
              <Field label={t.weapons.name}>
                <input
                  value={editing.name}
                  autoFocus
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
            )}
            {presets.length > 0 && (
              <>
                <Field label={t.weapons.type}>
                  <select
                    value={editing.type}
                    onChange={(e) => {
                      const type = e.target.value as Weapon["type"];
                      const current = presets.find((p) => p.name === editing.name);
                      const stillValid = current && current.typeKey === type;
                      const next = stillValid ? current : presetsForType(type)[0];
                      if (next) applyPreset(next);
                      else
                        setEditing({
                          ...editing,
                          type,
                          talent: "",
                          attributes: godRollAttributes(type, editing.isPrototype),
                        });
                    }}
                  >
                    {Object.entries(t.weapons.types).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Waffe">
                  <select
                    value={presets.some((p) => p.name === editing.name && p.typeKey === editing.type) ? editing.name : ""}
                    onChange={(e) => {
                      const p = presetsForType(editing.type).find((w) => w.name === e.target.value);
                      if (p) applyPreset(p);
                    }}
                  >
                    {!presets.some((p) => p.name === editing.name && p.typeKey === editing.type) && (
                      <option value="">– Bitte wählen –</option>
                    )}
                    {presetsForType(editing.type).map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}{p.isExotic ? " ★ Exotic" : p.isNamed ? " ● Named" : ""}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const p = presets.find((x) => x.name === editing.name && x.typeKey === editing.type);
                    if (!p) return null;
                    return (
                      <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                        {p.isExotic && <span className="badge exotic">Exotic</span>}
                        {p.isNamed && <span className="badge named">Named</span>}
                        {!p.isExotic && !p.isNamed && <span className="badge">High-End</span>}
                      </div>
                    );
                  })()}
                </Field>
              </>
            )}
            {editing.rarity !== "exotic" && (
              <Field label="Prototyp">
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={editing.isPrototype}
                    onChange={(e) => {
                      const isPrototype = e.target.checked;
                      setEditing({
                        ...editing,
                        isPrototype,
                        knowHow: isPrototype ? 30 : editing.knowHow,
                        attributes: godRollAttributes(editing.type, isPrototype),
                      });
                    }}
                  />
                  <span>Prototyp — alle Max-Werte +50 %</span>
                </label>
                {editing.isPrototype && (
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-dim, #aaa)" }}>
                    Prototyp: Know-How-Level fix 30
                  </p>
                )}
              </Field>
            )}
            <Field label="Know-How-Level (0–30)">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={1}
                  value={editing.knowHow}
                  disabled={editing.isPrototype}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      knowHow: Math.max(0, Math.min(30, Number(e.target.value))),
                    })
                  }
                  style={{ width: 80 }}
                />
                {editing.isPrototype && (
                  <span style={{ fontSize: 11, color: "var(--text-dim, #aaa)" }}>fix 30</span>
                )}
              </div>
            </Field>
            <Field label={t.weapons.talent}>
              <select
                value={editing.talent}
                onChange={(e) => setEditing({ ...editing, talent: e.target.value })}
              >
                <option value="">– Kein Talent –</option>
                {talentsForType(editing.type).map((tal) => (
                  <option key={tal.name} value={tal.name}>{tal.label}</option>
                ))}
              </select>
            </Field>
            <Field label={`Kern 1: +${weaponAttrMax(WEAPON_CORE1_MAX, editing.isPrototype)} % ${t.weapons.types[editing.type]}-Schaden (WD)`}>
              <input
                type="number"
                min={0}
                step={0.5}
                value={editing.attributes.core1}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    attributes: { ...editing.attributes, core1: Number(e.target.value) },
                  })
                }
              />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-dim, #aaa)" }}>
                Max (God Roll{editing.isPrototype ? ", Prototyp +50 %" : ""}): {weaponAttrMax(WEAPON_CORE1_MAX, editing.isPrototype)} %
                {editing.rarity === "exotic" ? " — Exote: Werte fix" : ""}
              </p>
            </Field>
            <Field label={`Kern 2: ${WEAPON_ATTR_LABELS[editing.attributes.core2Type]}`}>
              {WEAPON_CORE2_BY_TYPE[editing.type] === null ? (
                <select
                  value={editing.attributes.core2Type}
                  onChange={(e) => {
                    const key = e.target.value as WeaponAttrKey;
                    setEditing({
                      ...editing,
                      attributes: {
                        ...editing.attributes,
                        core2Type: key,
                        core2Val: weaponAttrMax(WEAPON_MINOR_MAX[key], editing.isPrototype),
                      },
                    });
                  }}
                >
                  {(Object.keys(WEAPON_ATTR_LABELS) as WeaponAttrKey[]).map((k) => (
                    <option key={k} value={k}>{WEAPON_ATTR_LABELS[k]}</option>
                  ))}
                </select>
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-dim, #aaa)" }}>
                  Durch die Waffengattung festgelegt.
                </p>
              )}
              <input
                type="number"
                min={0}
                step={0.5}
                value={editing.attributes.core2Val}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    attributes: { ...editing.attributes, core2Val: Number(e.target.value) },
                  })
                }
                style={{ marginTop: 6 }}
              />
              {(() => {
                const core2 = WEAPON_CORE2_BY_TYPE[editing.type];
                const max = core2
                  ? weaponAttrMax(core2.max, editing.isPrototype)
                  : weaponAttrMax(WEAPON_MINOR_MAX[editing.attributes.core2Type], editing.isPrototype);
                const over = editing.attributes.core2Val > max;
                return (
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: over ? "#e5544b" : "var(--text-dim, #aaa)" }}>
                    {over ? "⚠ Wert über Max: " : ""}Max (God Roll{editing.isPrototype ? ", Prototyp +50 %" : ""}): {max} %
                  </p>
                );
              })()}
            </Field>
            <Field label="Attribut 3 (Nebenattribut)">
              <select
                value={editing.attributes.minorType}
                onChange={(e) => {
                  const key = e.target.value as WeaponAttrKey;
                  setEditing({
                    ...editing,
                    attributes: {
                      ...editing.attributes,
                      minorType: key,
                      minorVal: weaponAttrMax(WEAPON_MINOR_MAX[key], editing.isPrototype),
                    },
                  });
                }}
              >
                {(Object.keys(WEAPON_ATTR_LABELS) as WeaponAttrKey[])
                  .filter((k) => k !== editing.attributes.core2Type || editing.rarity === "exotic")
                  .map((k) => (
                    <option key={k} value={k} disabled={k === editing.attributes.core2Type}>
                      {WEAPON_ATTR_LABELS[k]}
                    </option>
                  ))}
              </select>
              <input
                type="number"
                min={0}
                step={0.5}
                value={editing.attributes.minorVal}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    attributes: { ...editing.attributes, minorVal: Number(e.target.value) },
                  })
                }
                style={{ marginTop: 6 }}
              />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: editing.attributes.minorVal > weaponAttrMax(WEAPON_MINOR_MAX[editing.attributes.minorType], editing.isPrototype) ? "#e5544b" : "var(--text-dim, #aaa)" }}>
                Max (God Roll{editing.isPrototype ? ", Prototyp +50 %" : ""}): {weaponAttrMax(WEAPON_MINOR_MAX[editing.attributes.minorType], editing.isPrototype)} %
                {editing.rarity === "exotic" ? " — Exote: Werte fix" : ""}
              </p>
            </Field>
            <Field label={t.weapons.mods}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ALL_MOD_SLOTS.map((s) => {
                  const active = editing.modSlots.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`badge ${active ? "btn-accent" : ""}`}
                      style={{ cursor: "pointer", opacity: active ? 1 : 0.5 }}
                      onClick={() =>
                        setEditing({
                          ...editing,
                          modSlots: active
                            ? editing.modSlots.filter((x) => x !== s)
                            : [...editing.modSlots, s],
                        })
                      }
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </Field>
            <hr style={{ border: 0, borderTop: "1px solid var(--border, #555)", margin: "10px 0" }} />
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim, #aaa)" }}>
              Aus der Datenbank (readonly)
            </p>
            <Field label="Basiswert (Schaden)">
              <input type="number" min={0} value={editing.baseDamage} readOnly={presets.length > 0} onChange={(e) => setEditing({ ...editing, baseDamage: Number(e.target.value) })} />
            </Field>
            <Field label="RPM">
              <input type="number" min={0} value={editing.rpm} readOnly={presets.length > 0} onChange={(e) => setEditing({ ...editing, rpm: Number(e.target.value) })} />
            </Field>
            <Field label="Magazingröße">
              <input type="number" min={0} value={editing.magSize} readOnly={presets.length > 0} onChange={(e) => setEditing({ ...editing, magSize: Number(e.target.value) })} />
            </Field>
            <Field label="Hinweis (readonly)">
              <input value={editing.note ?? ""} readOnly={presets.length > 0} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
            </Field>
          </>
        )}
      </SidePanel>
    </div>
  );
}
