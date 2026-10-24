import { useContext, useEffect, useState } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";
import { DataTable } from "../components/DataTable";
import type { Column } from "../components/DataTable";
import { SidePanel, Field } from "../components/SidePanel";
import { ChartPlaceholder } from "../components/ChartPlaceholder";
import { getDb } from "../data/db";
import type { WeaponPreset, TalentEntry } from "../data/db";
import type { Weapon, WeaponType } from "../data/sampleData";

const ALL_MOD_SLOTS = ["optic", "muzzle", "underbarrel", "magazine"] as const;

function newWeapon(id: string): Weapon {
  return { id, name: "", type: "ar", rarity: "highend", baseDamage: 0, rpm: 0, magSize: 0, talent: "", modSlots: [...ALL_MOD_SLOTS] };
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
      render: (w) => <strong>{w.name}</strong>,
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
            {(!presets.some((p) => p.name === editing.name && p.typeKey === editing.type)) && (
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
                      setEditing({
                        ...editing,
                        type,
                        talent: "",
                        ...(next
                          ? {
                              name: next.name,
                              rarity: next.isExotic ? "exotic" : next.isNamed ? "named" : "highend",
                              baseDamage: next.baseDamage,
                              rpm: next.rpm,
                              magSize: next.magSize,
                              modSlots: [...ALL_MOD_SLOTS.slice(0, next.modSlotCount)],
                              note: next.note,
                            }
                          : {}),
                      });
                    }}
                  >
                    {Object.entries(t.weapons.types).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Waffe (aus Datenbank)">
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
                        {p.name}{p.isExotic ? " (Exotic)" : p.isNamed ? " (Named)" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
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
            <Field label="Basiswert (Schaden)">
              <input
                type="number"
                min={0}
                value={editing.baseDamage}
                readOnly={presets.length > 0}
                onChange={(e) => setEditing({ ...editing, baseDamage: Number(e.target.value) })}
              />
            </Field>
            <Field label="RPM">
              <input
                type="number"
                min={0}
                value={editing.rpm}
                readOnly={presets.length > 0}
                onChange={(e) => setEditing({ ...editing, rpm: Number(e.target.value) })}
              />
            </Field>
            <Field label="Magazingröße">
              <input
                type="number"
                min={0}
                value={editing.magSize}
                readOnly={presets.length > 0}
                onChange={(e) => setEditing({ ...editing, magSize: Number(e.target.value) })}
              />
            </Field>
            <Field label="Hinweis">
              <input
                value={editing.note ?? ""}
                onChange={(e) => setEditing({ ...editing, note: e.target.value })}
              />
            </Field>
            <Field label={t.weapons.mods}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(["optic", "muzzle", "underbarrel", "magazine"] as const).map((s) => {
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
            {editing.rarity === "exotic" && (
              <Field label={t.weapons.exoticTalentStacks}>
                <input type="range" min={0} max={100} defaultValue={50} style={{ width: "100%" }} />
              </Field>
            )}
          </>
        )}
      </SidePanel>
    </div>
  );
}
