import { useContext, useState } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";
import { DataTable } from "../components/DataTable";
import { DB_VERSION } from "../data/sampleData";

type AdminTab = "weapons" | "gear" | "brands" | "gearsets" | "mods";

export function AdminView() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const [tab, setTab] = useState<AdminTab>("weapons");

  const tabs: { key: AdminTab; label: string }[] = [
    { key: "weapons", label: t.admin.tabWeapons },
    { key: "gear", label: t.admin.tabGear },
    { key: "brands", label: t.admin.tabBrands },
    { key: "gearsets", label: t.admin.tabGearSets },
    { key: "mods", label: t.admin.tabMods },
  ];

  return (
    <div>
      <div className="toolbar">
        <span className="badge">{t.admin.dbVersion}: {DB_VERSION}</span>
        <span className="spacer" />
        <button className="btn btn-danger" onClick={() => confirm(t.admin.resetConfirm)}>
          {t.admin.reset}
        </button>
      </div>

      <div className="tabs">
        {tabs.map((tb) => (
          <button key={tb.key} className={`tab ${tab === tb.key ? "active" : ""}`} onClick={() => setTab(tb.key)}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "weapons" && (
        <DataTable
          rows={store.weapons}
          rowKey={(w) => w.id}
          searchPlaceholder="Suchen…"
          filterFn={(w, q) => w.name.toLowerCase().includes(q)}
          columns={[
            { key: "name", label: t.weapons.columns.name, render: (w) => w.name, sortValue: (w) => w.name },
            { key: "type", label: t.weapons.columns.type, render: (w) => t.weapons.types[w.type] },
            { key: "rarity", label: t.weapons.columns.rarity, render: (w) => t.weapons.rarities[w.rarity] },
            { key: "dmg", label: "Basisschaden", render: (w) => w.baseDamage.toLocaleString("de-DE"), sortValue: (w) => w.baseDamage },
            { key: "rpm", label: "RPM", render: (w) => w.rpm, sortValue: (w) => w.rpm },
          ]}
        />
      )}

      {tab === "gear" && (
        <DataTable
          rows={store.gear}
          rowKey={(g) => g.id}
          searchPlaceholder="Suchen…"
          filterFn={(g, q) => g.brand.toLowerCase().includes(q)}
          columns={[
            { key: "slot", label: t.gear.columns.slot, render: (g) => t.gear.slots[g.slot] },
            { key: "brand", label: t.gear.columns.brand, render: (g) => g.brand, sortValue: (g) => g.brand },
            { key: "core", label: t.gear.columns.core, render: (g) => g.core },
            { key: "talent", label: t.gear.columns.talent, render: (g) => g.talent ?? "–" },
          ]}
        />
      )}

      {tab === "brands" && (
        <DataTable
          rows={store.brandSets}
          rowKey={(b) => b.id}
          columns={[
            { key: "name", label: "Brand-Set", render: (b) => b.name, sortValue: (b) => b.name },
            { key: "bonuses", label: "Boni", render: (b) => b.bonuses.map((x) => `${x.pieces}× ${x.bonus}`).join(" · ") },
          ]}
        />
      )}

      {tab === "gearsets" && (
        <DataTable
          rows={store.gearSets}
          rowKey={(s) => s.id}
          columns={[
            { key: "name", label: "Gear-Set", render: (s) => s.name, sortValue: (s) => s.name },
            { key: "bonuses", label: "Boni", render: (s) => s.bonuses.map((x) => `${x.pieces}× ${x.bonus}`).join(" · ") },
          ]}
        />
      )}

      {tab === "mods" && (
        <DataTable
          rows={store.mods}
          rowKey={(m) => m.id}
          searchPlaceholder="Suchen…"
          filterFn={(m, q) => m.value.toLowerCase().includes(q)}
          columns={[
            { key: "cat", label: "Kategorie", render: (m) => m.category, sortValue: (m) => m.category },
            { key: "compat", label: "Kompatibel mit", render: (m) => m.compat.join(", ") },
            { key: "value", label: "Wert", render: (m) => m.value },
          ]}
        />
      )}

      <div className="hint" style={{ marginTop: 14 }}>
        {t.admin.validationOk} · {t.admin.standard}: {store.weapons.length + store.gear.length + store.mods.length} {t.admin.rows} · {t.admin.user}: 0 {t.admin.rows}
      </div>
    </div>
  );
}
