import { useContext, useRef, useState } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";
import { DataTable } from "../components/DataTable";
import { SidePanel, Field } from "../components/SidePanel";
import type { UserDbOverrides } from "../data/userDb";
import type { WeaponPreset, TalentEntry, GearPreset, GearTalentEntry, BrandBonusEntry, GearSetBonusEntry } from "../data/db";
import { WD_BY_WEAPON_ATTR, WD_BY_WEAPON_TYPES } from "../data/db";
import type { WeaponTypeKey } from "../data/db";
import { tWeaponName, tTalentName, tGearSetName, tSetBonusAttr, setBonusAttrEntry, type ItemLang } from "../i18n/itemNames";
import type { GearSlot } from "../data/sampleData";

type AdminTab =
  | "weapons"
  | "weaponTalents"
  | "gear"
  | "gearTalents"
  | "brands"
  | "gearSets"
  | "mods"
  | "attrs";

interface SetBonusDraftRow {
  pieces: number;
  attr: string;
  val: number;
  weaponType: string;
}

type DraftValue = string | number | boolean;
type Draft = Record<string, DraftValue>;

const TAB_CATEGORY: Record<AdminTab, keyof UserDbOverrides> = {
  weapons: "weapons",
  weaponTalents: "weaponTalents",
  gear: "gear",
  gearTalents: "gearTalents",
  brands: "brandSets",
  gearSets: "gearSets",
  mods: "mods",
  attrs: "attrNames",
};

const WEAPON_TYPES: WeaponTypeKey[] = ["ar", "smg", "lmg", "rifle", "mmr", "shotgun", "pistol"];
const GEAR_SLOTS: GearSlot[] = ["mask", "chest", "holster", "backpack", "gloves", "kneepads"];
const MOD_SLOTS = ["optic", "muzzle", "underbarrel", "magazine"] as const;

function weaponDraft(w: WeaponPreset): Draft {
  return {
    name: w.name,
    typeKey: w.typeKey,
    isExotic: w.isExotic,
    isNamed: w.isNamed,
    baseDamage: w.baseDamage,
    rpm: w.rpm,
    magSize: w.magSize,
    modSlotCount: w.modSlotCount,
    talent: w.talent ?? "",
    note: w.note,
  };
}

function talentDraft(t: TalentEntry): Draft {
  return {
    key: t.key,
    name: t.name,
    label: t.label,
    weaponTypes: t.weaponTypes.join(", "),
    group: t.group,
    description: t.description,
  };
}

function gearDraft(g: GearPreset): Draft {
  return {
    name: g.name,
    slot: g.slot,
    brand: g.brand,
    cls: g.cls,
    core: g.core,
    perk: g.perk,
    proto: g.proto,
    fixedAttrs: g.fixedAttrs.map((a) => `${a.type}, ${a.value}`).join("\n"),
  };
}

function gearTalentDraft(g: GearTalentEntry): Draft {
  return { key: g.key, slot: g.slot, label: g.label, note: g.note };
}

function brandDraft(b: { key: string; name: string; bonusEntries: BrandBonusEntry[] }): { draft: Draft; bonusRows: SetBonusDraftRow[] } {
  return {
    draft: { key: b.key, name: b.name },
    bonusRows: b.bonusEntries.map((e) => ({
      pieces: e.pieces,
      attr: e.attr,
      val: e.val,
      weaponType: e.weaponType ?? "",
    })),
  };
}

function gearSetDraft(s: { key: string; name: string; bonusEntries: GearSetBonusEntry[] }): { draft: Draft; bonusRows: SetBonusDraftRow[] } {
  return {
    draft: { key: s.key, name: s.name },
    bonusRows: s.bonusEntries.map((e) => ({
      pieces: e.pieces,
      attr: e.attr,
      val: e.val,
      weaponType: "",
    })),
  };
}

function attrDraft(key: string, de: string, en: string): Draft {
  return { key, de, en };
}

function modDraft(m: { name: string; slot: string; slotTypes: string[]; bonus: string; penalty: string | null }): Draft {
  return {
    name: m.name,
    slot: m.slot,
    compat: m.slotTypes.join(", "),
    bonus: m.bonus === "–" ? "" : m.bonus,
    penalty: m.penalty ?? "",
  };
}

function emptyDraft(tab: AdminTab): Draft {
  switch (tab) {
    case "weapons":
      return { name: "", typeKey: "ar", isExotic: false, isNamed: false, baseDamage: 0, rpm: 0, magSize: 0, modSlotCount: 0, talent: "", note: "" };
    case "weaponTalents":
      return { key: "", name: "", label: "", weaponTypes: "", group: "", description: "" };
    case "gear":
      return { name: "", slot: "mask", brand: "", cls: "named", core: "any", perk: "", proto: false, fixedAttrs: "" };
    case "gearTalents":
      return { key: "", slot: "chest", label: "", note: "" };
    case "brands":
    case "gearSets":
      return { key: "", name: "" };
    case "mods":
      return { name: "", slot: "optic", compat: "", bonus: "", penalty: "" };
    case "attrs":
      return { key: "", de: "", en: "" };
  }
}

function draftToEntry(tab: AdminTab, d: Draft, bonusRows: SetBonusDraftRow[]): Record<string, unknown> {
  const num = (k: string) => Number(d[k] ?? 0) || 0;
  const str = (k: string) => String(d[k] ?? "");
  switch (tab) {
    case "weapons":
      return {
        name: str("name"),
        typeKey: str("typeKey") as WeaponTypeKey,
        isExotic: Boolean(d.isExotic),
        isNamed: Boolean(d.isNamed),
        baseDamage: num("baseDamage"),
        rpm: num("rpm"),
        magSize: num("magSize"),
        modSlotCount: Math.min(4, Math.max(0, num("modSlotCount"))),
        talent: str("talent") || null,
        note: str("note"),
      };
    case "weaponTalents":
      return {
        key: str("key"),
        name: str("name") || str("key"),
        label: str("label") || str("name") || str("key"),
        weaponTypes: str("weaponTypes").split(",").map((s) => s.trim().toLowerCase()).filter((s) => (WEAPON_TYPES as string[]).includes(s)) as WeaponTypeKey[],
        group: str("group"),
        description: str("description"),
      };
    case "gear":
      return {
        name: str("name"),
        slot: str("slot") as GearSlot,
        brand: str("brand"),
        cls: str("cls") === "exotic" ? "exotic" : "named",
        core: str("core"),
        perk: str("perk"),
        proto: Boolean(d.proto),
        fixedAttrs: str("fixedAttrs")
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const [t, v] = l.split(",").map((x) => x.trim());
            return { type: t ?? "", value: Number(v ?? 0) || 0 };
          })
          .filter((a) => a.type),
        namedSpecialAttr: null,
      };
    case "gearTalents":
      return { key: str("key"), slot: str("slot") === "backpack" ? "backpack" : "chest", label: str("label") || str("key"), note: str("note") };
    case "brands":
    case "gearSets": {
      const rows = bonusRows.filter((r) => r.attr && r.pieces > 0 && Number.isFinite(r.val));
      if (tab === "brands") {
        return {
          key: str("key"),
          name: str("name") || str("key"),
          bonusEntries: rows.map((r: SetBonusDraftRow) => ({
            pieces: r.pieces,
            attr: r.attr,
            val: r.val,
            weaponType: r.attr === WD_BY_WEAPON_ATTR ? r.weaponType || undefined : undefined,
          })) as BrandBonusEntry[],
        };
      }
      return {
        key: str("key"),
        name: str("name") || str("key"),
        bonusEntries: rows.map((r: SetBonusDraftRow) => ({ pieces: r.pieces, attr: r.attr, val: r.val })) as GearSetBonusEntry[],
      };
    }
    case "attrs":
      return { de: str("de"), en: str("en") };
    case "mods":
      return {
        name: str("name"),
        slot: str("slot"),
        slotTypes: str("compat").split(",").map((s) => s.trim()).filter(Boolean),
        bonus: str("bonus"),
        penalty: str("penalty") || null,
      };
  }
}

function draftKey(tab: AdminTab, d: Draft): string {
  const k = tab === "weapons" || tab === "gear" || tab === "mods" ? String(d.name ?? "") : String(d.key ?? "");
  return k.trim();
}

function bonusRowsToText(rows: SetBonusDraftRow[] | undefined, lang: ItemLang, attrOverrides?: Record<string, { de?: string; en?: string } | null>): string {
  return (rows ?? [])
    .map((r) => {
      const attrLabel = tSetBonusAttr(r.attr, lang, r.attr, attrOverrides);
      const w = r.attr === WD_BY_WEAPON_ATTR && r.weaponType ? ` (${r.weaponType})` : "";
      return `${r.pieces}× ${attrLabel}${w} ${r.val > 0 ? "+" : ""}${r.val}`;
    })
    .join(" · ");
}

export function AdminView() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const [tab, setTab] = useState<AdminTab>("weapons");
  const [panelOpen, setPanelOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [originalKey, setOriginalKey] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft("weapons"));
  const bonusRowsRef = useRef<SetBonusDraftRow[]>([]);

  const tabs: { key: AdminTab; label: string }[] = [
    { key: "weapons", label: t.admin.tabWeapons },
    { key: "weaponTalents", label: t.admin.tabWeaponTalents },
    { key: "gear", label: t.admin.tabGear },
    { key: "gearTalents", label: t.admin.tabGearTalents },
    { key: "brands", label: t.admin.tabBrands },
    { key: "gearSets", label: t.admin.tabGearSets },
    { key: "mods", label: t.admin.tabMods },
    { key: "attrs", label: t.admin.tabAttrs },
  ];

  const db = store.db;
  const f = t.admin.form;
  const itemLang: ItemLang = store.lang;

  const customCount = Object.values(store.gameDb).reduce(
    (n, group) => n + Object.values(group).filter((v) => v !== null && v !== undefined).length,
    0,
  );

  function openNew() {
    setIsNew(true);
    setOriginalKey("");
    setDraft(emptyDraft(tab));
    bonusRowsRef.current = [];
    setPanelOpen(true);
  }

  function openEdit(key: string, d: Draft, bonusRows: SetBonusDraftRow[] = []) {
    setIsNew(false);
    setOriginalKey(key);
    setDraft(d);
    bonusRowsRef.current = bonusRows;
    setPanelOpen(true);
  }

  const [, setBonusRowsTick] = useState(0);
  const setBonusRows = (rows: SetBonusDraftRow[]) => {
    bonusRowsRef.current = rows;
    setBonusRowsTick((n) => n + 1);
  };

  function onSave() {
    const category = TAB_CATEGORY[tab];
    const key = draftKey(tab, draft);
    if (!key) return;
    const entry = draftToEntry(tab, draft, bonusRowsRef.current);
    if (!isNew && originalKey && originalKey !== key) {
      store.setGameDbOverride(category, originalKey, null);
    }
    store.setGameDbOverride(category, key, entry);
    store.setStatus(`${key} gespeichert`);
    setPanelOpen(false);
  }

  function onDelete(key: string) {
    if (!confirm(t.admin.deleteConfirm)) return;
    store.setGameDbOverride(TAB_CATEGORY[tab], key, null);
    store.setStatus(`${key} zurückgesetzt`);
  }

  const rowActionsFor = <T,>(keyOf: (row: T) => string, draftOf: (row: T) => Draft | { draft: Draft; bonusRows: SetBonusDraftRow[] }) => [
    {
      label: t.admin.editRow,
      onAction: (row: T) => {
        const d = draftOf(row);
        if (typeof d === "object" && d !== null && "draft" in d) openEdit(keyOf(row), (d as { draft: Draft; bonusRows: SetBonusDraftRow[] }).draft, (d as { bonusRows: SetBonusDraftRow[] }).bonusRows);
        else openEdit(keyOf(row), d as Draft);
      },
    },
    { label: t.admin.deleteRow, className: "btn btn-danger", onAction: (row: T) => onDelete(keyOf(row)) },
  ];

  const set = (k: string, v: DraftValue) => setDraft((d) => ({ ...d, [k]: v }));
  const numField = (k: string, label: string) => (
    <Field key={k} label={label}>
      <input type="number" min={0} value={Number(draft[k] ?? 0)} onChange={(e) => set(k, Number(e.target.value))} />
    </Field>
  );
  const textField = (k: string, label: string) => (
    <Field key={k} label={label}>
      <input type="text" value={String(draft[k] ?? "")} onChange={(e) => set(k, e.target.value)} />
    </Field>
  );

  function renderForm() {
    switch (tab) {
      case "weapons":
        return (
          <>
            {textField("name", f.name)}
            <Field label={f.type}>
              <select value={String(draft.typeKey)} onChange={(e) => set("typeKey", e.target.value)}>
                {WEAPON_TYPES.map((wt) => (
                  <option key={wt} value={wt}>{t.weapons.types[wt]}</option>
                ))}
              </select>
            </Field>
            <Field label={f.isExotic}>
              <input type="checkbox" checked={Boolean(draft.isExotic)} onChange={(e) => set("isExotic", e.target.checked)} />
            </Field>
            <Field label={f.isNamed}>
              <input type="checkbox" checked={Boolean(draft.isNamed)} onChange={(e) => set("isNamed", e.target.checked)} />
            </Field>
            {numField("baseDamage", f.baseDamage)}
            {numField("rpm", f.rpm)}
            {numField("magSize", f.magSize)}
            {numField("modSlotCount", f.modSlotCount)}
            {textField("talent", f.talent)}
            {textField("note", f.note)}
          </>
        );
      case "weaponTalents":
        return (
          <>
            {textField("key", f.key)}
            {textField("name", f.name)}
            {textField("label", f.label)}
            {textField("weaponTypes", f.weaponTypes)}
            {textField("group", f.group)}
            <Field label={f.description}>
              <textarea rows={3} value={String(draft.description ?? "")} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </>
        );
      case "gear":
        return (
          <>
            {textField("name", f.name)}
            <Field label={f.slot}>
              <select value={String(draft.slot)} onChange={(e) => set("slot", e.target.value)}>
                {GEAR_SLOTS.map((s) => (
                  <option key={s} value={s}>{t.gear.slots[s]}</option>
                ))}
              </select>
            </Field>
            {textField("brand", f.brand)}
            <Field label={f.cls}>
              <select value={String(draft.cls)} onChange={(e) => set("cls", e.target.value)}>
                <option value="named">Named</option>
                <option value="exotic">Exotic</option>
              </select>
            </Field>
            {textField("core", f.core)}
            {textField("perk", f.perk)}
            <Field label={f.proto}>
              <input type="checkbox" checked={Boolean(draft.proto)} onChange={(e) => set("proto", e.target.checked)} />
            </Field>
            <Field label={f.fixedAttrs}>
              <textarea rows={3} value={String(draft.fixedAttrs ?? "")} onChange={(e) => set("fixedAttrs", e.target.value)} />
            </Field>
          </>
        );
      case "gearTalents":
        return (
          <>
            {textField("key", f.key)}
            <Field label={f.slot}>
              <select value={String(draft.slot)} onChange={(e) => set("slot", e.target.value)}>
                <option value="chest">{t.gear.slots.chest}</option>
                <option value="backpack">{t.gear.slots.backpack}</option>
              </select>
            </Field>
            {textField("label", f.label)}
            <Field label={f.description}>
              <textarea rows={3} value={String(draft.note ?? "")} onChange={(e) => set("note", e.target.value)} />
            </Field>
          </>
        );
      case "brands":
      case "gearSets":
        return (
          <>
            {textField("key", f.key)}
            {textField("name", f.name)}
            <Field label={f.bonuses}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(bonusRowsRef.current ?? []).map((row, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={row.pieces}
                      title={f.pieces}
                      style={{ width: 52 }}
                      onChange={(e) =>
                        setBonusRows((bonusRowsRef.current ?? []).map((r, j) => (j === i ? { ...r, pieces: Number(e.target.value) } : r)))
                      }
                    />
                    <select
                      value={row.attr}
                      style={{ minWidth: 200 }}
                      onChange={(e) =>
                        setBonusRows((bonusRowsRef.current ?? []).map((r, j) => (j === i ? { ...r, attr: e.target.value } : r)))
                      }
                    >
                      <option value="">—</option>
                      {(db?.setBonusAttrs ?? []).map((a) => (
                        <option key={a} value={a}>{tSetBonusAttr(a, itemLang, a, store.gameDb.attrNames)}</option>
                      ))}
                      {!db?.setBonusAttrs.includes(WD_BY_WEAPON_ATTR) && (
                        <option value={WD_BY_WEAPON_ATTR}>{tSetBonusAttr(WD_BY_WEAPON_ATTR, itemLang, "Waffenschaden nach Waffentyp", store.gameDb.attrNames)}</option>
                      )}
                    </select>
                    {row.attr === WD_BY_WEAPON_ATTR && tab === "brands" && (
                      <select
                        value={row.weaponType}
                        onChange={(e) =>
                          setBonusRows((bonusRowsRef.current ?? []).map((r, j) => (j === i ? { ...r, weaponType: e.target.value } : r)))
                        }
                      >
                        <option value="">—</option>
                        {WD_BY_WEAPON_TYPES.map((w) => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                    )}
                    <input
                      type="number"
                      step="any"
                      value={row.val}
                      title={f.value}
                      style={{ width: 80 }}
                      onChange={(e) =>
                        setBonusRows((bonusRowsRef.current ?? []).map((r, j) => (j === i ? { ...r, val: Number(e.target.value) } : r)))
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ fontSize: 11, padding: "2px 8px" }}
                      onClick={() => setBonusRows((bonusRowsRef.current ?? []).filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn"
                  style={{ alignSelf: "flex-start", fontSize: 12 }}
                  onClick={() => setBonusRows([...(bonusRowsRef.current ?? []), { pieces: 2, attr: "", val: 0, weaponType: "" }])}
                >
                  + {f.addBonusRow}
                </button>
              </div>
            </Field>
          </>
        );
      case "attrs":
        return (
          <>
            {textField("key", f.key)}
            {textField("de", f.nameDe)}
            {textField("en", f.nameEn)}
          </>
        );
      case "mods":
        return (
          <>
            {textField("name", f.name)}
            <Field label={f.category}>
              <select value={String(draft.slot)} onChange={(e) => set("slot", e.target.value)}>
                {MOD_SLOTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            {textField("compat", f.compat)}
            {textField("bonus", f.bonus)}
            {textField("penalty", f.penalty)}
          </>
        );
    }
  }

  return (
    <div>
      <div className="toolbar">
        <span className="badge">
          {t.admin.dbVersion}: {db
            ? `weapons ${db.versions.weapons} · gear ${db.versions.gear} · mods ${db.versions.mods} · talents ${db.versions.talents}`
            : "—"}
        </span>
        <span className="badge">{customCount} {t.admin.customCount}</span>
        <span className="spacer" />
        <button className="btn btn-accent" onClick={openNew}>{t.admin.addNew}</button>
        <button
          className="btn btn-danger"
          disabled={customCount === 0}
          onClick={() => { if (confirm(t.admin.resetConfirm)) { store.resetGameDb(); store.setStatus(t.admin.reset); } }}
        >
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

      {db && tab === "weapons" && (
        <DataTable
          rows={db.weapons}
          rowKey={(w) => w.name}
          searchPlaceholder={`${t.common.search}…`}
          filterFn={(w, q) => w.name.toLowerCase().includes(q)}
          rowActions={rowActionsFor((w: WeaponPreset) => w.name, weaponDraft)}
          columns={[
            { key: "name", label: t.weapons.columns.name, render: (w) => tWeaponName(w.name, itemLang, w.name), sortValue: (w) => w.name },
            { key: "type", label: t.weapons.columns.type, render: (w) => t.weapons.types[w.typeKey] },
            { key: "rarity", label: t.weapons.columns.rarity, render: (w) => (w.isExotic ? t.weapons.rarities.exotic : w.isNamed ? t.weapons.rarities.named : t.weapons.rarities.highend) },
            { key: "dmg", label: "Basisschaden", render: (w) => w.baseDamage.toLocaleString("de-DE"), sortValue: (w) => w.baseDamage },
            { key: "rpm", label: "RPM", render: (w) => w.rpm, sortValue: (w) => w.rpm },
          ]}
        />
      )}

      {db && tab === "weaponTalents" && (
        <DataTable
          rows={db.talents}
          rowKey={(x) => x.key}
          searchPlaceholder={`${t.common.search}…`}
          filterFn={(x, q) => x.name.toLowerCase().includes(q) || x.key.toLowerCase().includes(q)}
          rowActions={rowActionsFor((x: TalentEntry) => x.key, talentDraft)}
          columns={[
            { key: "name", label: t.weapons.columns.name, render: (x) => tTalentName(x.name, itemLang, x.name), sortValue: (x) => x.name },
            { key: "label", label: "Label", render: (x) => tTalentName(x.label, itemLang, x.label) },
            { key: "types", label: t.weapons.columns.type, render: (x) => x.weaponTypes.map((wt) => t.weapons.types[wt]).join(", ") },
            { key: "group", label: "Gruppe", render: (x) => x.group, sortValue: (x) => x.group },
          ]}
        />
      )}

      {db && tab === "gear" && (
        <DataTable
          rows={db.gear}
          rowKey={(g) => g.name}
          searchPlaceholder={`${t.common.search}…`}
          filterFn={(g, q) => g.name.toLowerCase().includes(q) || g.brand.toLowerCase().includes(q)}
          rowActions={rowActionsFor((g: GearPreset) => g.name, gearDraft)}
          columns={[
            { key: "name", label: t.gear.columns.brand, render: (g) => g.name, sortValue: (g) => g.name },
            { key: "slot", label: t.gear.columns.slot, render: (g) => t.gear.slots[g.slot] },
            { key: "brand", label: "Marke", render: (g) => g.brand, sortValue: (g) => g.brand },
            { key: "core", label: t.gear.columns.core, render: (g) => g.core },
            { key: "perk", label: t.gear.columns.talent, render: (g) => g.perk || "–" },
          ]}
        />
      )}

      {db && tab === "gearTalents" && (
        <DataTable
          rows={db.gearTalents}
          rowKey={(g) => g.key}
          searchPlaceholder={`${t.common.search}…`}
          filterFn={(g, q) => g.label.toLowerCase().includes(q) || g.key.toLowerCase().includes(q)}
          rowActions={rowActionsFor((g: GearTalentEntry) => g.key, gearTalentDraft)}
          columns={[
            { key: "label", label: t.gear.columns.talent, render: (g) => tTalentName(g.label, itemLang, g.label), sortValue: (g) => g.label },
            { key: "slot", label: t.gear.columns.slot, render: (g) => t.gear.slots[g.slot] },
            { key: "note", label: "Notiz", render: (g) => g.note },
          ]}
        />
      )}

      {db && tab === "brands" && (
        <DataTable
          rows={db.brandSets}
          rowKey={(b) => b.key}
          searchPlaceholder={`${t.common.search}…`}
          filterFn={(b, q) => b.name.toLowerCase().includes(q)}
          rowActions={rowActionsFor((b) => b.key, brandDraft)}
          columns={[
            { key: "name", label: "Brand-Set", render: (b) => b.name, sortValue: (b) => b.name },
            { key: "bonuses", label: "Boni", render: (b) => bonusRowsToText(b.bonusEntries.map((e) => ({ pieces: e.pieces, attr: e.attr, val: e.val, weaponType: e.weaponType ?? "" })), itemLang) || "–" },
          ]}
        />
      )}

      {db && tab === "gearSets" && (
        <DataTable
          rows={db.gearSets}
          rowKey={(s) => s.key}
          searchPlaceholder={`${t.common.search}…`}
          filterFn={(s, q) => s.name.toLowerCase().includes(q) || tGearSetName(s.name, itemLang, s.name).toLowerCase().includes(q)}
          rowActions={rowActionsFor((s) => s.key, gearSetDraft)}
          columns={[
            { key: "name", label: "Gear-Set", render: (s) => tGearSetName(s.key, itemLang, s.name), sortValue: (s) => s.name },
            { key: "bonuses", label: "Boni", render: (s) => bonusRowsToText(s.bonusEntries.map((e) => ({ pieces: e.pieces, attr: e.attr, val: e.val, weaponType: "" })), itemLang) || "–" },
          ]}
        />
      )}

      {db && tab === "attrs" && (
        <DataTable
          rows={db.setBonusAttrs.map((key: string) => {
            const base = setBonusAttrEntry(key);
            const o = store.gameDb.attrNames[key];
            const de = o && typeof o === "object" && o.de ? o.de : base?.de ?? key;
            const en = o && typeof o === "object" && o.en ? o.en : base?.en ?? key;
            return { key, de, en };
          })}
          rowKey={(a: { key: string; de: string; en: string }) => a.key}
          searchPlaceholder={`${t.common.search}…`}
          filterFn={(a: { key: string; de: string; en: string }, q) => a.key.toLowerCase().includes(q) || a.de.toLowerCase().includes(q) || a.en.toLowerCase().includes(q)}
          rowActions={rowActionsFor((a: { key: string; de: string; en: string }) => a.key, (a: { key: string; de: string; en: string }) => attrDraft(a.key, a.de, a.en))}
          columns={[
            { key: "key", label: "Attribut-ID", render: (a: { key: string; de: string; en: string }) => a.key, sortValue: (a: { key: string; de: string; en: string }) => a.key },
            { key: "de", label: f.nameDe, render: (a: { key: string; de: string; en: string }) => a.de, sortValue: (a: { key: string; de: string; en: string }) => a.de },
            { key: "en", label: f.nameEn, render: (a: { key: string; de: string; en: string }) => a.en, sortValue: (a: { key: string; de: string; en: string }) => a.en },
          ]}
        />
      )}

      {db && tab === "mods" && (
        <DataTable
          rows={db.mods}
          rowKey={(m) => m.name}
          searchPlaceholder={`${t.common.search}…`}
          filterFn={(m, q) => m.name.toLowerCase().includes(q) || (m.bonus ?? "").toLowerCase().includes(q)}
          rowActions={rowActionsFor((m) => m.name, modDraft)}
          columns={[
            { key: "name", label: t.weapons.columns.name, render: (m) => m.name, sortValue: (m) => m.name },
            { key: "cat", label: "Slot", render: (m) => m.slot, sortValue: (m) => m.slot },
            { key: "compat", label: "Kompatibel mit", render: (m) => m.slotTypes.join(", ") },
            { key: "value", label: "Wert", render: (m) => [m.bonus, m.penalty].filter(Boolean).join(" · ") || "–" },
          ]}
        />
      )}

      <div className="hint" style={{ marginTop: 14 }}>
        {t.admin.validationOk} · {t.admin.standard}: {db ? db.weapons.length + db.gear.length + db.mods.length + db.talents.length + db.gearTalents.length + db.brandSets.length + db.gearSets.length : 0} {t.admin.rows} · {t.admin.user}: {customCount} {t.admin.rows}
      </div>

      <SidePanel
        open={panelOpen}
        title={isNew ? t.admin.addNew : t.admin.editRow}
        onClose={() => setPanelOpen(false)}
        footer={
          <>
            <span className="spacer" />
            <button className="btn" onClick={() => setPanelOpen(false)}>{t.common.cancel}</button>
            <button className="btn btn-accent" onClick={onSave}>{t.common.save}</button>
          </>
        }
      >
        {renderForm()}
      </SidePanel>
    </div>
  );
}
