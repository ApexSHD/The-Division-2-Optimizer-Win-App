import { useContext, useEffect, useState } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";
import { DataTable } from "../components/DataTable";
import type { Column } from "../components/DataTable";
import { SidePanel, Field } from "../components/SidePanel";
import { getDb, GEAR_TALENTS } from "../data/db";
import type { GearPreset, BrandItemPreset, GearSetItemPreset } from "../data/db";
import type { GearPiece, GearSlot, GearCoreType, GearAttrKey } from "../data/sampleData";
import {
  GEAR_CORE_LABELS,
  GEAR_CORE_MAX,
  GEAR_ATTR_TYPES,
  gearAttrMax,
  gearCoreMax,
} from "../data/sampleData";
import { gearToCsv, gearFromCsv } from "../data/gearCsv";

function newGear(id: string): GearPiece {
  return {
    id,
    slot: "mask",
    brand: "",
    brandType: "brand",
    core: "wd",
    coreValue: gearCoreMax("wd", true),
    attributes: [],
    talent: null,
    prototype: true,
  };
}

export function GearView() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<GearPiece | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [presets, setPresets] = useState<GearPreset[]>([]);
  const [brands, setBrands] = useState<BrandItemPreset[]>([]);
  const [gearSets, setGearSets] = useState<GearSetItemPreset[]>([]);
  const [filterSlot, setFilterSlot] = useState<"" | GearSlot>("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterRarity, setFilterRarity] = useState<"" | "brand" | "gearset" | "named" | "exotic">("");

  useEffect(() => {
    getDb()
      .then((db) => {
        setPresets(db.gear);
        setBrands(db.brandItems);
        setGearSets(db.gearSetItems);
      })
      .catch(() => {
        setPresets([]);
        setBrands([]);
        setGearSets([]);
      });
  }, []);

  const presetsForSlot = (slot: GearSlot) => presets.filter((p) => p.slot === slot);
  const dbItem = editing ? presets.find((p) => p.name === editing.brand && p.slot === editing.slot) : undefined;
  const isDbItem = Boolean(dbItem);
  const isExotic = editing?.brandType === "exotic";
  const usedAttrTypes = new Set(editing?.attributes.map((a) => a.type) ?? []);
  const talentOptions =
    editing && (editing.slot === "chest" || editing.slot === "backpack") && editing.brandType === "brand"
      ? GEAR_TALENTS.filter((tal) => tal.slot === editing.slot)
      : [];

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

  function onDeleteRow(g: GearPiece) {
    if (!confirm(`${g.brand} ${t.common.delete}?`)) return;
    store.removeGear(g.id);
    store.setStatus(`${g.brand} gel\u00f6scht`);
  }

  function applyPreset(p: GearPreset) {
    if (!editing) return;
    const isEx = p.cls === "exotic";
    const core = (p.core === "Waffenschaden" ? "wd" : p.core === "Panzerung" ? "armour" : p.core === "Skill-Hastung" ? "skill" : "wd") as GearCoreType;
    setEditing({
      ...editing,
      slot: p.slot,
      brand: p.name,
      brandType: isEx ? "exotic" : "named",
      core,
      coreValue: core === "wd" ? GEAR_CORE_MAX.wd : core === "armour" ? GEAR_CORE_MAX.armour : GEAR_CORE_MAX.skill,
      attributes: p.fixedAttrs.map((a) => ({ type: a.type as GearAttrKey, value: a.value })),
      talent: p.perk || null,
      prototype: isEx ? false : true,
    });
  }

  function onSelectSlot(slot: GearSlot) {
    if (!editing) return;
    const stillValid = editing.brandType !== "brand" && editing.brandType !== "gearset" && presets.some((p) => p.name === editing.brand && p.slot === slot);
    setEditing({
      ...editing,
      slot,
      brand: stillValid ? editing.brand : "",
      brandType: stillValid ? editing.brandType : "brand",
      attributes: stillValid ? editing.attributes : [],
      talent: stillValid ? editing.talent : null,
      prototype: stillValid && editing.brandType !== "exotic" ? editing.prototype : true,
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
    store.setStatus(`${editing.brand} gel\u00f6scht`);
  }

  async function onExportCsv() {
    if (store.gear.length === 0) {
      store.setStatus("Keine Gear-Teile zum Exportieren");
      return;
    }
    const csv = gearToCsv(store.gear);
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    const suggestedName = `gear-inventar-${new Date().toISOString().slice(0, 10)}.csv`;
    if (isTauri) {
      const path = prompt(`Dateipfad f\u00fcr den CSV-Export eingeben`, `${store.storagePath ?? "."}${store.storagePath ? "/" : ""}${suggestedName}`);
      if (!path) return;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("write_text_file", { path, content: csv });
        store.setStatus(`CSV exportiert: ${path}`);
      } catch (e) {
        store.setStatus(`CSV-Export fehlgeschlagen: ${e}`);
      }
    } else {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = suggestedName;
      a.click();
      URL.revokeObjectURL(url);
      store.setStatus("CSV exportiert (Download)");
    }
  }

  async function onImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const { gear, skippedRows } = gearFromCsv(text, () =>
        `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      );
      if (gear.length === 0) {
        store.setStatus("CSV-Import: keine g\u00fcltigen Gear-Teile gefunden");
        return;
      }
      for (const g of gear) store.addGear(g);
      store.setStatus(`${gear.length} Gear-Teil(e) importiert${skippedRows ? `, ${skippedRows} Zeile(n) \u00fcbersprungen` : ""}`);
    } catch (err) {
      store.setStatus(`CSV-Import fehlgeschlagen: ${err}`);
    }
  }

  const attrText = (g: GearPiece) =>
    g.attributes.map((a) => `${GEAR_ATTR_TYPES[a.type]?.label ?? a.type} +${a.value}`).join(", ");

  const coreText = (g: GearPiece) =>
    `${GEAR_CORE_LABELS[g.core]}: ${g.core === "skill" ? `Tier ${g.coreValue}` : `+${g.coreValue.toLocaleString("de-DE")}${g.core === "wd" ? " %" : ""}`}`;

  const columns: Column<GearPiece>[] = [
    {
      key: "slot",
      label: t.gear.columns.slot,
      render: (g) => t.gear.slots[g.slot],
      sortValue: (g) => t.gear.slots[g.slot],
    },
    {
      key: "brand",
      label: "Marke / Set",
      render: (g) => <strong>{g.brand}</strong>,
      sortValue: (g) => g.brand,
    },
    {
      key: "brandType",
      label: "Besonderheit",
      render: (g) => (
        <span className={`badge ${g.brandType === "exotic" ? "exotic" : g.brandType === "named" ? "named" : g.brandType === "gearset" ? "gearset" : ""}`}>
          {g.brandType === "brand" ? "High-End" : g.brandType === "gearset" ? "Gear-Set" : g.brandType === "named" ? "Named" : "Exotic"}
        </span>
      ),
      sortValue: (g) => g.brandType,
    },
    {
      key: "prototype",
      label: "Prototyp",
      render: (g) => (g.prototype ? "ja" : "nein"),
      sortValue: (g) => (g.prototype ? 1 : 0),
    },
    {
      key: "core",
      label: "1. Attribut",
      render: (g) => coreText(g),
      sortValue: (g) => g.coreValue,
    },
    {
      key: "attributes",
      label: "2. / 3. Attribut",
      render: (g) => attrText(g) || "\u2013",
      sortValue: (g) => attrText(g),
    },
    {
      key: "talent",
      label: "Talent / Perk",
      render: (g) => g.talent ?? "\u2013",
      sortValue: (g) => g.talent ?? "",
    },
  ];

  return (
    <div>
      <DataTable
        rows={store.gear}
        columns={columns}
        rowKey={(g) => g.id}
        searchPlaceholder={t.gear.search}
        filterFn={(g, q) =>
          g.brand.toLowerCase().includes(q) &&
          (!filterSlot || g.slot === filterSlot) &&
          (!filterBrand || g.brand.toLowerCase().includes(filterBrand.toLowerCase())) &&
          (!filterRarity || g.brandType === filterRarity)
        }
        onRowDoubleClick={openEdit}
        rowActions={[
          { label: "\u270e", title: "Gear-Teil bearbeiten", onAction: (g) => openEdit(g) },
          { label: "\u2715", title: "Gear-Teil l\u00f6schen", className: "btn-danger", onAction: (g) => onDeleteRow(g) },
        ]}
        toolbar={
          <>
            <select
              aria-label="Slot-Filter"
              value={filterSlot}
              onChange={(e) => setFilterSlot(e.target.value as "" | GearSlot)}
              style={{ minWidth: 120 }}
            >
              <option value="">Alle Slots</option>
              {Object.entries(t.gear.slots).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              aria-label="Marke/Set-Filter"
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              style={{ minWidth: 140 }}
            >
              <option value="">Alle Marken/Sets</option>
              {[...new Set(store.gear.map((g) => g.brand))].sort().map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <select
              aria-label="Besonderheit-Filter"
              value={filterRarity}
              onChange={(e) => setFilterRarity(e.target.value as "" | "brand" | "gearset" | "named" | "exotic")}
              style={{ minWidth: 120 }}
            >
              <option value="">Alle Besonderheiten</option>
              <option value="brand">High-End</option>
              <option value="gearset">Gear-Set</option>
              <option value="named">Named</option>
              <option value="exotic">Exotic</option>
            </select>
            <button className="btn" onClick={onExportCsv}>CSV exportieren</button>
            <label className="btn" style={{ cursor: "pointer" }}>
              CSV importieren
              <input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={onImportCsv} />
            </label>
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
            <Field label={t.gear.slot}>
              <select value={editing.slot} onChange={(e) => onSelectSlot(e.target.value as GearSlot)}>
                {Object.entries(t.gear.slots).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Kategorie">
              <select
                value={editing.brandType}
                onChange={(e) => {
                  const brandType = e.target.value as GearPiece["brandType"];
                  if (brandType === "brand" || brandType === "gearset") {
                    setEditing({
                      ...editing,
                      brandType,
                      brand: "",
                      attributes: [],
                      talent: null,
                      prototype: true,
                    });
                  } else {
                    const first = presetsForSlot(editing.slot).find((p) =>
                      brandType === "exotic" ? p.cls === "exotic" : p.cls === "named",
                    );
                    if (first) applyPreset(first);
                    else
                      setEditing({
                        ...editing,
                        brandType,
                        brand: "",
                        attributes: [],
                        talent: null,
                        prototype: brandType === "exotic" ? false : true,
                      });
                  }
                }}
              >
                <option value="brand">Brand-Set (High-End)</option>
                <option value="gearset">Gear-Set (gr\u00fcn)</option>
                <option value="named">Named</option>
                <option value="exotic">Exotic</option>
              </select>
            </Field>
            {(editing.brandType === "named" || editing.brandType === "exotic") && (
              <Field label={editing.brandType === "exotic" ? "Exotic-Item" : "Named-Item"}>
                <select
                  value={isDbItem ? editing.brand : ""}
                  onChange={(e) => {
                    const p = presetsForSlot(editing.slot).find((x) => x.name === e.target.value);
                    if (p) applyPreset(p);
                  }}
                >
                  {!isDbItem && <option value="">\u2013 Bitte ausw\u00e4hlen \u2013</option>}
                  {presetsForSlot(editing.slot)
                    .filter((p) => (editing.brandType === "exotic" ? p.cls === "exotic" : p.cls === "named"))
                    .map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                </select>
                {isDbItem && dbItem?.perk && (
                  <p className="settings-hint">{dbItem.perk}</p>
                )}
              </Field>
            )}
            {editing.brandType === "brand" && (
              <Field label="Marke">
                <select
                  value={editing.brand}
                  onChange={(e) => setEditing({ ...editing, brand: e.target.value })}
                >
                  <option value="">\u2013 Bitte ausw\u00e4hlen \u2013</option>
                  {brands.map((b) => (
                    <option key={b.brand} value={b.brand}>{b.brand}</option>
                  ))}
                </select>
              </Field>
            )}
            {editing.brandType === "gearset" && (
              <Field label="Gear-Set">
                <select
                  value={editing.brand}
                  onChange={(e) => setEditing({ ...editing, brand: e.target.value })}
                >
                  <option value="">\u2013 Bitte ausw\u00e4hlen \u2013</option>
                  {gearSets.map((gs) => (
                    <option key={gs.key} value={gs.name}>{gs.name}</option>
                  ))}
                </select>
              </Field>
            )}

            <label className="check-row">
              <input
                type="checkbox"
                checked={editing.prototype}
                disabled={isExotic}
                onChange={(e) => {
                  const prototype = isExotic ? false : e.target.checked;
                  setEditing({
                    ...editing,
                    prototype,
                    coreValue: isDbItem ? editing.coreValue : gearCoreMax(editing.core, prototype),
                  });
                }}
              />
              <span className="check-text">Prototyp</span>
            </label>

            <Field label="1. Attribut (Kern)">
              {isDbItem ? (
                <>
                  <input value={`${GEAR_CORE_LABELS[editing.core]}: ${coreText(editing).split(": ")[1]}`} readOnly />
                  {isExotic && <p className="settings-hint">Exotische Items haben fixe Werte.</p>}
                </>
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  <select
                    value={editing.core}
                    onChange={(e) => {
                      const core = e.target.value as GearCoreType;
                      setEditing({ ...editing, core, coreValue: gearCoreMax(core, editing.prototype) });
                    }}
                  >
                    {(Object.keys(GEAR_CORE_LABELS) as GearCoreType[]).map((k) => (
                      <option key={k} value={k}>{GEAR_CORE_LABELS[k]}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    step={editing.core === "armour" ? 1000 : 0.5}
                    value={editing.coreValue}
                    style={{ width: 110 }}
                    onChange={(e) => setEditing({ ...editing, coreValue: Number(e.target.value) })}
                  />
                </div>
              )}
              {!isDbItem && (
                <p className="settings-hint">
                  Max (God Roll{editing.prototype ? ", Prototyp +50 %" : ""}):{" "}
                  {editing.core === "skill" ? "Tier 1" : gearCoreMax(editing.core, editing.prototype).toLocaleString("de-DE")}
                </p>
              )}
            </Field>

            {[0, 1].map((idx) => {
              const attr = editing.attributes[idx];
              const isFixed = isDbItem && isExotic;
              return (
                <Field key={idx} label={`${idx + 2}. Attribut${attr ? "" : " (optional)"}`}>
                  {isFixed ? (
                    <input
                      value={attr ? `${GEAR_ATTR_TYPES[attr.type as GearAttrKey]?.label ?? attr.type} +${attr.value}` : "\u2013 nicht m\u00f6glich \u2013"}
                      readOnly
                    />
                  ) : (
                    <div style={{ display: "flex", gap: 6 }}>
                      <select
                        value={attr?.type ?? ""}
                        onChange={(e) => {
                          const type = e.target.value as GearAttrKey | "";
                          const attrs = [...editing.attributes];
                          if (!type) {
                            attrs.splice(idx, 1);
                          } else {
                            const max = gearAttrMax(type, editing.prototype);
                            const existing = attrs[idx];
                            attrs[idx] = { type, value: existing && existing.type === type ? existing.value : max ?? 0 };
                          }
                          setEditing({ ...editing, attributes: attrs.filter(Boolean) });
                        }}
                      >
                        <option value="">\u2013 nicht belegt \u2013</option>
                        {(Object.keys(GEAR_ATTR_TYPES) as GearAttrKey[])
                          .filter((k) => k === attr?.type || !usedAttrTypes.has(k))
                          .map((k) => (
                            <option key={k} value={k}>{GEAR_ATTR_TYPES[k].label}</option>
                          ))}
                      </select>
                      {attr && (
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={attr.value}
                          style={{ width: 90 }}
                          onChange={(e) => {
                            const attrs = [...editing.attributes];
                            attrs[idx] = { ...attr, value: Number(e.target.value) };
                            setEditing({ ...editing, attributes: attrs });
                          }}
                        />
                      )}
                    </div>
                  )}
                  {attr && !isFixed && gearAttrMax(attr.type, editing.prototype) != null && (
                    <p className="settings-hint">
                      Max (God Roll{editing.prototype ? ", Prototyp +50 %" : ""}): {gearAttrMax(attr.type, editing.prototype)}
                    </p>
                  )}
                </Field>
              );
            })}

            <Field label="Talent">
              {isDbItem ? (
                <>
                  <input value={editing.talent ?? ""} readOnly />
                  {dbItem?.perk && <p className="settings-hint">{dbItem.perk}</p>}
                </>
              ) : talentOptions.length > 0 ? (
                <select
                  value={editing.talent ?? ""}
                  onChange={(e) => setEditing({ ...editing, talent: e.target.value || null })}
                >
                  <option value="">\u2013 kein Talent \u2013</option>
                  {talentOptions.map((tal) => (
                    <option key={tal.key} value={tal.label}>{tal.label}</option>
                  ))}
                </select>
              ) : (
                <p className="settings-hint" style={{ margin: 0 }}>
                  {isExotic
                    ? "Exotische Items haben immer ein besonderes Talent/Perk aus der Datenbank."
                    : editing.brandType === "named"
                      ? "Named-Items haben einen fixen Perk aus der Datenbank (oder ein besonderes Attribut statt Talent)."
                      : "Freie Talente nur bei High-End Weste/Rucksack."}
                </p>
              )}
              {editing.talent && talentOptions.some((tal) => tal.label === editing.talent) && (
                <p className="settings-hint">
                  {talentOptions.find((tal) => tal.label === editing.talent)?.note}
                </p>
              )}
            </Field>
          </>
        )}
      </SidePanel>
    </div>
  );
}
