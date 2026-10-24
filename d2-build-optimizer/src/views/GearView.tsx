import { useContext, useEffect, useState } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";
import { DataTable } from "../components/DataTable";
import type { Column } from "../components/DataTable";
import { SidePanel, Field } from "../components/SidePanel";
import { PresetPicker } from "../components/PresetPicker";
import { getDb } from "../data/db";
import type { GearPreset } from "../data/db";
import type { GearPiece, GearSlot } from "../data/sampleData";

function newGear(id: string): GearPiece {
  return { id, slot: "mask", brand: "", brandType: "brand", core: "", attributes: [], talent: null, prototype: false };
}

export function GearView() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<GearPiece | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [slotFilter, setSlotFilter] = useState<string>("all");
  const [presets, setPresets] = useState<GearPreset[]>([]);

  useEffect(() => {
    getDb().then((db) => setPresets(db.gear)).catch(() => setPresets([]));
  }, []);

  const gear = slotFilter === "all" ? store.gear : store.gear.filter((g) => g.slot === slotFilter);

  const columns: Column<GearPiece>[] = [
    {
      key: "slot",
      label: t.gear.columns.slot,
      render: (g) => t.gear.slots[g.slot],
      sortValue: (g) => t.gear.slots[g.slot],
    },
    {
      key: "brand",
      label: t.gear.columns.brand,
      render: (g) => <strong>{g.brand}</strong>,
      sortValue: (g) => g.brand,
    },
    {
      key: "core",
      label: t.gear.columns.core,
      render: (g) => g.core,
      sortValue: (g) => g.core,
    },
    {
      key: "attributes",
      label: t.gear.columns.attribute,
      render: (g) => g.attributes.join(", "),
    },
    {
      key: "talent",
      label: t.gear.columns.talent,
      render: (g) => g.talent ?? "–",
    },
  ];

  function openEdit(g: GearPiece) {
    setEditing(g);
    setIsNew(false);
    setPanelOpen(true);
  }

  function openNew() {
    setEditing(newGear(`g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`));
    setIsNew(true);
    setPanelOpen(true);
  }

  function applyPreset(p: GearPreset) {
    if (!editing) return;
    setEditing({
      ...editing,
      slot: p.slot,
      brand: p.brand ? `${p.name} (${p.brand})` : p.name,
      brandType: p.cls === "exotic" ? "exotic" : "named",
      core: p.core,
      attributes: p.fixedAttributes,
      talent: p.perk || null,
      prototype: p.proto,
    });
  }

  function onSave() {
    if (!editing) return;
    if (!editing.brand.trim()) {
      store.setStatus(t.gear.brand + " fehlt");
      return;
    }
    if (isNew) store.addGear(editing);
    else store.updateGear(editing);
    setPanelOpen(false);
    store.setStatus(isNew ? `${editing.brand} angelegt` : `${editing.brand} gespeichert`);
  }

  function onDelete() {
    if (!editing || isNew) return;
    if (!confirm(`${editing.brand} ${t.common.delete}?`)) return;
    store.removeGear(editing.id);
    setPanelOpen(false);
    store.setStatus(`${editing.brand} gelöscht`);
  }

  return (
    <div>
      <DataTable
        rows={gear}
        columns={columns}
        rowKey={(g) => g.id}
        searchPlaceholder={t.gear.search}
        filterFn={(g, q) => g.brand.toLowerCase().includes(q) || g.core.toLowerCase().includes(q)}
        onRowDoubleClick={openEdit}
        toolbar={
          <>
            <select value={slotFilter} onChange={(e) => setSlotFilter(e.target.value)}>
              <option value="all">Alle Slots</option>
              {Object.entries(t.gear.slots).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button className="btn btn-accent" onClick={openNew}>
              + {t.gear.new}
            </button>
          </>
        }
      />

      <SidePanel
        open={panelOpen}
        title={editing && !isNew ? t.gear.edit : t.gear.new}
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
                label="Aus Datenbank übernehmen (Gear)"
                items={presets}
                getItemLabel={(p) => p.name}
                getItemGroup={(p) => t.gear.slots[p.slot]}
                onPick={applyPreset}
              />
            )}
            <Field label={t.gear.slot}>
              <select
                value={editing.slot}
                onChange={(e) => setEditing({ ...editing, slot: e.target.value as GearSlot })}
              >
                {Object.entries(t.gear.slots).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label={t.gear.brand}>
              <input
                value={editing.brand}
                autoFocus
                onChange={(e) => setEditing({ ...editing, brand: e.target.value })}
              />
            </Field>
            <Field label="Kategorie">
              <select
                value={editing.brandType}
                onChange={(e) => setEditing({ ...editing, brandType: e.target.value as GearPiece["brandType"] })}
              >
                <option value="brand">Brand-Set</option>
                <option value="gearset">Gear-Set</option>
                <option value="named">Named</option>
                <option value="exotic">Exotic</option>
              </select>
            </Field>
            <Field label={t.gear.core}>
              <input
                value={editing.core}
                onChange={(e) => setEditing({ ...editing, core: e.target.value })}
              />
            </Field>
            <Field label={t.gear.attribute}>
              <input
                value={editing.attributes.join("; ")}
                placeholder="CHC +6 %; CHD +6 %"
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    attributes: e.target.value.split(";").map((s) => s.trim()).filter(Boolean),
                  })
                }
              />
            </Field>
            <Field label={t.gear.talent}>
              <input
                value={editing.talent ?? ""}
                placeholder="—"
                onChange={(e) => setEditing({ ...editing, talent: e.target.value || null })}
              />
            </Field>
            <Field label={t.common.prototype}>
              <input
                type="checkbox"
                checked={editing.prototype}
                onChange={(e) => setEditing({ ...editing, prototype: e.target.checked })}
              />
            </Field>
          </>
        )}
      </SidePanel>
    </div>
  );
}
