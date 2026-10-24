import { useContext, useState } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";
import { DataTable } from "../components/DataTable";
import type { Column } from "../components/DataTable";
import { SidePanel, Field } from "../components/SidePanel";
import { ChartPlaceholder } from "../components/ChartPlaceholder";
import type { Weapon } from "../data/sampleData";

export function WeaponsView() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedWeapon, setSelectedWeapon] = useState<Weapon | null>(null);

  function openEdit(w: Weapon) {
    setSelectedWeapon(w);
    setPanelOpen(true);
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
          <button className="btn btn-accent" onClick={() => openEdit(store.weapons[0])}>
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
        title={selectedWeapon ? t.weapons.edit : t.weapons.new}
        onClose={() => setPanelOpen(false)}
        footer={
          <>
            <button className="btn" onClick={() => setPanelOpen(false)}>{t.common.cancel}</button>
            <button className="btn btn-accent" onClick={() => setPanelOpen(false)}>{t.common.save}</button>
          </>
        }
      >
        {selectedWeapon && (
          <>
            <Field label={t.weapons.name}>
              <input defaultValue={selectedWeapon.name} />
            </Field>
            <Field label={t.weapons.type}>
              <select defaultValue={selectedWeapon.type}>
                {Object.entries(t.weapons.types).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label={t.weapons.rarity}>
              <select defaultValue={selectedWeapon.rarity}>
                {Object.entries(t.weapons.rarities).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label={t.weapons.talent}>
              <input defaultValue={selectedWeapon.talent} />
            </Field>
            <Field label="Basiswert (Schaden)">
              <input type="number" defaultValue={selectedWeapon.baseDamage} />
            </Field>
            <Field label="RPM">
              <input type="number" defaultValue={selectedWeapon.rpm} />
            </Field>
            <Field label="Magazingröße">
              <input type="number" defaultValue={selectedWeapon.magSize} />
            </Field>
            <Field label={t.weapons.modsAuto}>
              <button className="btn" onClick={() => undefined}>⚡ Auto</button>
            </Field>
            <Field label={t.weapons.mods}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {selectedWeapon.modSlots.map((s) => (
                  <span key={s} className="badge">{s}</span>
                ))}
              </div>
            </Field>
            {selectedWeapon.rarity === "exotic" && (
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
