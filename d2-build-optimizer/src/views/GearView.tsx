import { useContext, useState } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";
import { DataTable } from "../components/DataTable";
import type { Column } from "../components/DataTable";
import { SidePanel, Field } from "../components/SidePanel";
import type { GearPiece } from "../data/sampleData";

export function GearView() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selected, setSelected] = useState<GearPiece | null>(null);
  const [slotFilter, setSlotFilter] = useState<string>("all");

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
    setSelected(g);
    setPanelOpen(true);
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
            <button className="btn btn-accent" onClick={() => openEdit(store.gear[0])}>
              + {t.gear.new}
            </button>
          </>
        }
      />

      <SidePanel
        open={panelOpen}
        title={selected ? t.gear.edit : t.gear.new}
        onClose={() => setPanelOpen(false)}
        footer={
          <>
            <button className="btn" onClick={() => setPanelOpen(false)}>{t.common.cancel}</button>
            <button className="btn btn-accent" onClick={() => setPanelOpen(false)}>{t.common.save}</button>
          </>
        }
      >
        {selected && (
          <>
            <Field label={t.gear.slot}>
              <select defaultValue={selected.slot}>
                {Object.entries(t.gear.slots).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label={t.gear.brand}>
              <input defaultValue={selected.brand} />
            </Field>
            <Field label={t.gear.core}>
              <input defaultValue={selected.core} />
            </Field>
            <Field label={t.gear.attribute}>
              <input defaultValue={selected.attributes.join("; ")} />
            </Field>
            <Field label={t.gear.talent}>
              <input defaultValue={selected.talent ?? ""} placeholder="—" />
            </Field>
            <Field label={t.common.prototype}>
              <input type="checkbox" defaultChecked={selected.prototype} />
            </Field>
          </>
        )}
      </SidePanel>
    </div>
  );
}
