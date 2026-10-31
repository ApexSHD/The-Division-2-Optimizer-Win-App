import { useContext, useEffect, useState } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";
import { DataTable } from "../components/DataTable";
import type { Column } from "../components/DataTable";
import { SidePanel, Field } from "../components/SidePanel";
import { ImportPreview, type PreviewRow } from "../components/ImportPreview";
import { ChartPlaceholder } from "../components/ChartPlaceholder";
import { getDb } from "../data/db";
import type { WeaponPreset, DisplayTalent } from "../data/db";
import { TALENT_DISPLAY_TYPE_MAP, talentsAllowedForWeapon, carrierForTalent } from "../data/db";
import type { Weapon, WeaponType, WeaponAttrKey } from "../data/sampleData";
import { weaponsToCsv, weaponsFromCsv } from "../data/weaponCsv";
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
    isPrototype: true,
    attributes: godRollAttributes("ar", true),
  };
}

export function WeaponsView() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Weapon | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [presets, setPresets] = useState<WeaponPreset[]>([]);
  const [displayTalents, setDisplayTalents] = useState<DisplayTalent[]>([]);
  const [talentDisplayByType, setTalentDisplayByType] = useState<Record<string, DisplayTalent[]>>({});
  const [filterType, setFilterType] = useState<"" | WeaponType>("");
  const [filterRarity, setFilterRarity] = useState<"" | "highend" | "named" | "exotic">("");
  const [filterTalent, setFilterTalent] = useState("");

  useEffect(() => {
    getDb()
      .then((db) => {
        setPresets(db.weapons);
        setDisplayTalents(db.displayTalents);
        setTalentDisplayByType(db.talentDisplayByType);
      })
      .catch(() => {
        setPresets([]);
        setDisplayTalents([]);
        setTalentDisplayByType({});
      });
  }, []);

  const presetsForType = (type: WeaponType) => presets.filter((p) => p.typeKey === type);
  const currentPreset = presets.find((p) => p.name === editing?.name && p.typeKey === editing?.type);
  const fixedTalent =
    editing?.rarity === "exotic" || editing?.rarity === "named"
      ? currentPreset?.talent ?? null
      : null;
  const talentDescription = (() => {
    const all = [
      ...displayTalents,
      ...(talentDisplayByType[TALENT_DISPLAY_TYPE_MAP[editing?.type ?? "ar"]] ?? []),
    ];
    const name = editing?.talent;
    const found = all.find((tal) => tal.name === name);
    return found?.description ?? null;
  })();
  const talentOptions = (type: WeaponType) => {
    const general = displayTalents;
    const cat = talentDisplayByType[TALENT_DISPLAY_TYPE_MAP[type]] ?? [];
    const allowed = talentsAllowedForWeapon(editing?.name ?? "", editing?.rarity === "named");
    return { general: general.filter((x) => allowed(x.name)), cat: cat.filter((x) => allowed(x.name)) };
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
      isPrototype: !p.isExotic,
      knowHow: 30,
      attributes: godRollAttributes(p.typeKey, !p.isExotic),
    });
  }

  function onSaveAndNext() {
    onSave();
    if (!editing || !editing.name.trim()) return;
    openNew();
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

  function onDeleteRow(w: Weapon) {
    if (!confirm(`${w.name} ${t.common.delete}?`)) return;
    store.removeWeapon(w.id);
    store.setStatus(`${w.name} gelöscht`);
  }

  async function onExportCsv() {
    if (store.weapons.length === 0) {
      store.setStatus("Keine Waffen zum Exportieren");
      return;
    }
    const csv = weaponsToCsv(store.weapons);
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    const suggestedName = `waffen-inventar-${new Date().toISOString().slice(0, 10)}.csv`;
    if (isTauri) {
      const path = prompt(`Dateipfad für den CSV-Export eingeben`, `${store.storagePath ?? "."}${store.storagePath ? "/" : ""}${suggestedName}`);
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

  const [preview, setPreview] = useState<{
    fileName: string;
    rows: PreviewRow[];
    weapons: Weapon[];
    skippedRows: number;
    warnings: string[];
  } | null>(null);

  async function readImportFile(file: File) {
    try {
      const text = await file.text();
      const { weapons, skippedRows, warnings } = weaponsFromCsv(text, () =>
        `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      );
      const rows: PreviewRow[] = weapons.map((w, i) => ({
        key: `${w.id}-${i}`,
        label: `${w.name} (${w.type.toUpperCase()}${w.talent ? ` · ${w.talent}` : ""})`,
        detail: w.isPrototype ? "Prototyp — Kern/Attribute mit Prototyp-Maximum" : "",
        status: "ok" as const,
      }));
      const warned = new Set<string>();
      for (const warning of warnings) {
        const match = warning.match(/^„(.+?)“/);
        const key = match ? match[1] : warning;
        if (warned.has(key)) continue;
        warned.add(key);
        const rowIdx = rows.findIndex((r) => r.label.startsWith(`${key} (`) || r.label === key);
        if (rowIdx >= 0) {
          rows[rowIdx] = { ...rows[rowIdx], status: "warn", detail: warning };
        } else {
          rows.push({ key: `warn-${rows.length}`, label: key, detail: warning, status: "warn" });
        }
      }
      if (weapons.length === 0 && skippedRows > 0) {
        rows.push({
          key: "no-rows",
          label: `${skippedRows} Zeile(n) unlesbar`,
          detail: warnings.join(" · ") || "Spalten passen nicht zur Vorlage.",
          status: "error",
        });
      }
      setPreview({ fileName: file.name, rows, weapons, skippedRows, warnings });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      store.setStatus(
        `CSV-Import fehlgeschlagen: ${msg}. Lösung: Spalten „Name“, „Typ“, „Attribut 1–3“ prüfen — Vorlage über „CSV exportieren“ erzeugen und daran orientieren.`,
      );
    }
  }

  async function onImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await readImportFile(file);
  }

  function confirmImport(mode: "replace" | "merge") {
    if (!preview) return;
    store.noteImport(preview.warnings, preview.skippedRows, "Waffen");
    const weaponKey = (w: Weapon) =>
      `${w.name}::${w.type}::${w.baseDamage}::${w.knowHow}::${w.modSlots.join(",")}::${w.attributes.core1}::${w.attributes.core2Type ?? ""}::${w.attributes.core2Val ?? 0}`;
    if (mode === "replace") {
      store.setWeapons(preview.weapons);
      store.setStatus(`${preview.weapons.length} Waffe(n) importiert (Inventar ersetzt)`);
    } else {
      const seen = new Set(store.weapons.map(weaponKey));
      const toImport: Weapon[] = [];
      let duplicates = 0;
      for (const w of preview.weapons) {
        const key = weaponKey(w);
        if (seen.has(key)) {
          duplicates++;
          continue;
        }
        seen.add(key);
        toImport.push(w);
      }
      store.addWeaponBulk(toImport);
      const parts = [`${toImport.length} Waffe(n) importiert`];
      if (duplicates) parts.push(`${duplicates} Duplikat(e) übersprungen`);
      store.setStatus(parts.join(", "));
    }
    setPreview(null);
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
      key: "prototype",
      label: "Prototyp",
      render: (w) => (w.isPrototype ? "ja" : "nein"),
      sortValue: (w) => (w.isPrototype ? 1 : 0),
    },
    {
      key: "attr1",
      label: "Attribut 1",
      render: (w) => `WD +${w.attributes.core1} %`,
      sortValue: (w) => w.attributes.core1,
    },
    {
      key: "attr2",
      label: "Attribut 2",
      render: (w) => `${WEAPON_ATTR_LABELS[w.attributes.core2Type]} +${w.attributes.core2Val} %`,
      sortValue: (w) => w.attributes.core2Val,
    },
    {
      key: "attr3",
      label: "Attribut 3",
      render: (w) => `${WEAPON_ATTR_LABELS[w.attributes.minorType]} +${w.attributes.minorVal} %`,
      sortValue: (w) => w.attributes.minorVal,
    },
    {
      key: "talent",
      label: t.weapons.columns.talent,
      render: (w) => w.talent,
      sortValue: (w) => w.talent,
    },
    {
      key: "dps",
      label: "Basis-DPS",
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
        filterFn={(w, q) =>
          (w.name.toLowerCase().includes(q) || w.talent.toLowerCase().includes(q)) &&
          (!filterType || w.type === filterType) &&
          (!filterRarity || w.rarity === filterRarity) &&
          (!filterTalent || w.talent === filterTalent)
        }
        onRowDoubleClick={openEdit}
        rowActions={[
          { label: "✎", title: "Waffe bearbeiten", onAction: (w) => openEdit(w) },
          { label: "✕", title: "Waffe löschen", className: "btn-danger", onAction: (w) => onDeleteRow(w) },
        ]}
        toolbar={
          <>
            <select
              aria-label="Typ-Filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as "" | WeaponType)}
              style={{ minWidth: 130 }}
            >
              <option value="">{t.weapons.filterType}</option>
              {Object.entries(t.weapons.types).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              aria-label="Art-Filter"
              value={filterRarity}
              onChange={(e) => setFilterRarity(e.target.value as "" | "highend" | "named" | "exotic")}
              style={{ minWidth: 120 }}
            >
              <option value="">{t.weapons.filterRarity}</option>
              <option value="highend">High-End</option>
              <option value="named">Named</option>
              <option value="exotic">Exotic</option>
            </select>
            <select
              aria-label="Talent-Filter"
              value={filterTalent}
              onChange={(e) => setFilterTalent(e.target.value)}
              style={{ minWidth: 140 }}
            >
              <option value="">Alle Talente</option>
              {[...new Set(store.weapons.map((w) => w.talent).filter(Boolean))].sort().map((tal) => (
                <option key={tal} value={tal}>{tal}</option>
              ))}
            </select>
            <button className="btn" onClick={onExportCsv}>CSV exportieren</button>
            <label className="btn" style={{ cursor: "pointer" }}>
              CSV importieren
              <input
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={onImportCsv}
              />
            </label>
            <button className="btn btn-accent" onClick={openNew}>
              + {t.weapons.new}
            </button>
          </>
        }
      />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file && file.name.toLowerCase().endsWith(".csv")) readImportFile(file);
        }}
      >
      </div>

      <ImportPreview
        open={preview !== null}
        title="CSV-Import — Vorschau (Waffen)"
        fileName={preview?.fileName ?? ""}
        rows={preview?.rows ?? []}
        itemCount={preview?.weapons.length ?? 0}
        skippedRows={preview?.skippedRows ?? 0}
        existingCount={store.weapons.length}
        onCancel={() => setPreview(null)}
        onConfirm={confirmImport}
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
            {isNew && (
              <button className="btn btn-accent" onClick={onSaveAndNext} title="Speichern und direkt die nächste Waffe erfassen">
                Speichern + nächste
              </button>
            )}
          </>
        }
      >
        {editing && (
          <>
            {(() => {
              const warnings: string[] = [];
              const max1 = weaponAttrMax(WEAPON_CORE1_MAX, editing.isPrototype);
              if (editing.attributes.core1 > max1) warnings.push(`Kern 1: ${editing.attributes.core1} % > Max ${max1} %`);
              const core2 = WEAPON_CORE2_BY_TYPE[editing.type];
              const max2 = core2
                ? weaponAttrMax(core2.max, editing.isPrototype)
                : weaponAttrMax(WEAPON_MINOR_MAX[editing.attributes.core2Type], editing.isPrototype);
              if (editing.attributes.core2Val > max2) warnings.push(`Kern 2: ${editing.attributes.core2Val} % > Max ${max2} %`);
              const max3 = weaponAttrMax(WEAPON_MINOR_MAX[editing.attributes.minorType], editing.isPrototype);
              if (editing.attributes.minorVal > max3) warnings.push(`Attribut 3: ${editing.attributes.minorVal} % > Max ${max3} %`);
              if (editing.knowHow > 30) warnings.push(`Know-How: ${editing.knowHow} > Max 30`);
              if (warnings.length === 0) return null;
              return (
                <div className="field-warn">
                  ⚠ Wert(e) über dem Maximalwert:
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {warnings.map((w) => <li key={w}>{w}</li>)}
                  </ul>
                </div>
              );
            })()}
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
              <label className="check-row">
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
                <span className="check-text">Prototyp</span>
              </label>
            )}
            <Field label="Know-How-Level (0–30): Standard 30 % Waffenschaden">
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
              {(() => {
                const max1 = weaponAttrMax(WEAPON_CORE1_MAX, editing.isPrototype);
                const over1 = editing.attributes.core1 > max1;
                return (
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: over1 ? "#e5544b" : "var(--text-dim, #aaa)" }}>
                    {over1 ? "⚠ Wert über Max: " : ""}Max (God Roll{editing.isPrototype ? ", Prototyp +50 %" : ""}): {max1} %
                    {editing.rarity === "exotic" ? " — Exote: Werte fix" : ""}
                  </p>
                );
              })()}
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
                {editing.attributes.minorVal > weaponAttrMax(WEAPON_MINOR_MAX[editing.attributes.minorType], editing.isPrototype) ? "⚠ Wert über Max: " : ""}Max (God Roll{editing.isPrototype ? ", Prototyp +50 %" : ""}): {weaponAttrMax(WEAPON_MINOR_MAX[editing.attributes.minorType], editing.isPrototype)} %
                {editing.rarity === "exotic" ? " — Exote: Werte fix" : ""}
              </p>
            </Field>
            <Field label="Talent">
              {fixedTalent ? (
                <>
                  <input value={editing.talent} readOnly />
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-dim, #aaa)" }}>
                    {editing.rarity === "exotic"
                      ? "Fixes exotisches Talent – nicht veränderbar."
                      : `Fixes Named-Talent – nicht veränderbar.${carrierForTalent(editing.talent) ? ` (Träger: ${carrierForTalent(editing.talent)})` : ""}`}
                  </p>
                </>
              ) : (
                <select
                  value={editing.talent}
                  onChange={(e) => setEditing({ ...editing, talent: e.target.value })}
                >
                  <option value="">– Kein Talent –</option>
                  <optgroup label="Allgemeine Waffen">
                    {talentOptions(editing.type).general.map((tal) => (
                      <option key={tal.name} value={tal.name}>
                        {tal.name.startsWith("Perfekt") ? `★ ${tal.name}` : tal.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={`${TALENT_DISPLAY_TYPE_MAP[editing.type]} (Gattungs-Talente)`}>
                    {talentOptions(editing.type).cat.map((tal) => (
                      <option key={tal.name} value={tal.name}>
                        {tal.name.startsWith("Perfekt") ? `★ ${tal.name}` : tal.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              )}
              {talentDescription && (
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-dim, #aaa)" }}>
                  {talentDescription}
                </p>
              )}
            </Field>
            <Field label="Mods">
              {editing.rarity === "exotic" ? (
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-dim, #aaa)" }}>
                  Exotische Waffen haben fixe Mods aus der Datenbank.
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-dim, #aaa)" }}>
                  Mod-Erfassung folgt in einer Ausbaustufe.
                </p>
              )}
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
