import { useContext, useEffect, useState } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";
import { DataTable } from "../components/DataTable";
import type { Column } from "../components/DataTable";
import { SidePanel, Field } from "../components/SidePanel";
import { ChartPlaceholder } from "../components/ChartPlaceholder";
import { PresetPicker } from "../components/PresetPicker";
import { getDb } from "../data/db";
import type { WeaponPreset } from "../data/db";
import type { Weapon } from "../data/sampleData";

function newWeapon(id: string): Weapon {
  return { id, name: "", type: "ar", rarity: "highend", baseDamage: 0, rpm: 0, magSize: 0, talent: "", modSlots: ["optic", "muzzle", "underbarrel", "magazine"] };
}

export function WeaponsView() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Weapon | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [presets, setPresets] = useState<WeaponPreset[]>([]);

  useEffect(() => {
    getDb().then((db) => setPresets(db.weapons)).catch(() => setPresets([]));
  }, []);

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
    const slots = (["optic", "muzzle", "underbarrel", "magazine"] as const).slice(0, p.modSlotCount);
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
            {isNew && presets.length > 0 && (
              <PresetPicker
                label="Aus Datenbank übernehmen (Waffe)"
                items={presets}
                getItemLabel={(p) => p.name}
                getItemGroup={(p) => t.weapons.types[p.typeKey]}
                onPick={applyPreset}
              />
            )}
            <Field label={t.weapons.name}>
              <input
                value={editing.name}
                autoFocus
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>
            <Field label={t.weapons.type}>
              <select
                value={editing.type}
                onChange={(e) => setEditing({ ...editing, type: e.target.value as Weapon["type"] })}
              >
                {Object.entries(t.weapons.types).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label={t.weapons.rarity}>
              <select
                value={editing.rarity}
                onChange={(e) => setEditing({ ...editing, rarity: e.target.value as Weapon["rarity"] })}
              >
                {Object.entries(t.weapons.rarities).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label={t.weapons.talent}>
              <input
                value={editing.talent}
                onChange={(e) => setEditing({ ...editing, talent: e.target.value })}
              />
            </Field>
            <Field label="Basiswert (Schaden)">
              <input
                type="number"
                min={0}
                value={editing.baseDamage}
                onChange={(e) => setEditing({ ...editing, baseDamage: Number(e.target.value) })}
              />
            </Field>
            <Field label="RPM">
              <input
                type="number"
                min={0}
                value={editing.rpm}
                onChange={(e) => setEditing({ ...editing, rpm: Number(e.target.value) })}
              />
            </Field>
            <Field label="Magazingröße">
              <input
                type="number"
                min={0}
                value={editing.magSize}
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
