import { useMemo, useState } from "react";
import { useStore } from "../store";
import { SidePanel } from "./SidePanel";
import {
  gearShortLabel,
  weaponShortLabel,
  findGearDuplicates,
} from "../data/itemLabels";
import type { GearPiece, GearSlot, Weapon } from "../data/sampleData";

const SLOT_LABELS: Record<GearSlot, string> = {
  mask: "Maske",
  chest: "Weste",
  holster: "Holster",
  backpack: "Rucksack",
  gloves: "Handschuhe",
  kneepads: "Knieschoner",
};

const TYPE_LABELS: Record<Weapon["type"], string> = {
  ar: "Sturmgewehr",
  smg: "Maschinenpistole",
  lmg: "LMG",
  rifle: "Gewehr",
  mmr: "Präzisionsgewehr",
  shotgun: "Schrotflinte",
  pistol: "Pistole",
};

export type PickerTarget =
  | { kind: "weapon" }
  | { kind: "gear"; slot: GearSlot };

export function ItemPicker({
  open,
  target,
  selectedId,
  onPick,
  onClose,
}: {
  open: boolean;
  target: PickerTarget;
  selectedId: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const store = useStore();
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("");

  const duplicates = useMemo(() => findGearDuplicates(store.gear), [store.gear]);

  const brands = useMemo(() => {
    const pool = target.kind === "gear" ? store.gear.filter((g) => g.slot === target.slot) : store.gear;
    return [...new Set(pool.map((g) => g.brand))].sort();
  }, [store.gear, target]);

  const gearRows = useMemo(() => {
    if (target.kind !== "gear") return [];
    const q = query.trim().toLowerCase();
    return store.gear
      .filter((g) => g.slot === target.slot)
      .filter((g) => !brandFilter || g.brand === brandFilter)
      .filter((g) => {
        if (!q) return true;
        return gearShortLabel(g).toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const dupA = duplicates.duplicateIds.has(a.id) ? 0 : 1;
        const dupB = duplicates.duplicateIds.has(b.id) ? 0 : 1;
        if (dupA !== dupB) return dupA - dupB;
        return a.brand.localeCompare(b.brand) || b.coreValue - a.coreValue;
      });
  }, [store.gear, target, query, brandFilter, duplicates]);

  const weaponRows = useMemo(() => {
    if (target.kind !== "weapon") return [];
    const q = query.trim().toLowerCase();
    return store.weapons
      .filter((w) => !brandFilter || w.type === brandFilter)
      .filter((w) => {
        if (!q) return true;
        return weaponShortLabel(w).toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [store.weapons, target, query, brandFilter]);

  const title =
    target.kind === "weapon"
      ? "Waffe auswählen"
      : `${SLOT_LABELS[target.slot]} auswählen`;

  const close = () => {
    setQuery("");
    setBrandFilter("");
    onClose();
  };

  return (
    <SidePanel
      open={open}
      title={title}
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close}>
            Abbrechen
          </button>
          <span className="spacer" />
          {selectedId && (
            <button
              className="btn btn-danger"
              onClick={() => {
                onPick("");
                close();
              }}
            >
              Auswahl leeren
            </button>
          )}
        </>
      }
    >
      <div className="field" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="search"
          placeholder="Suchen (Marke, Attribut, Talent…)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: "1 1 180px" }}
          autoFocus
        />
        {target.kind === "gear" && (
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
            <option value="">Alle Marken/Sets</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        )}
        {target.kind === "weapon" && (
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
            <option value="">Alle Gattungen</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        )}
      </div>
      <div className="field" style={{ maxHeight: "56vh", overflow: "auto", display: "grid", gap: 6 }}>
        {target.kind === "gear" &&
          gearRows.map((g) => (
            <GearRow
              key={g.id}
              g={g}
              selected={g.id === selectedId}
              isDuplicate={duplicates.duplicateIds.has(g.id)}
              onPick={() => {
                onPick(g.id);
                close();
              }}
            />
          ))}
        {target.kind === "weapon" &&
          weaponRows.map((w) => (
            <WeaponRow
              key={w.id}
              w={w}
              selected={w.id === selectedId}
              onPick={() => {
                onPick(w.id);
                close();
              }}
            />
          ))}
        {target.kind === "gear" && gearRows.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-dim, #aaa)" }}>
            Keine Teile für diesen Slot{query ? " mit diesem Suchbegriff" : ""} im Inventar.
          </div>
        )}
        {target.kind === "weapon" && weaponRows.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-dim, #aaa)" }}>
            Keine Waffen{query ? " mit diesem Suchbegriff" : ""} im Inventar.
          </div>
        )}
      </div>
      <small style={{ color: "var(--text-dim, #aaa)" }}>
        Klick übernimmt die Auswahl. Duplikate (identische Werte) stehen zusammen und sind mit ⚠ markiert.
      </small>
    </SidePanel>
  );
}

function GearRow({
  g,
  selected,
  isDuplicate,
  onPick,
}: {
  g: GearPiece;
  selected: boolean;
  duplicateCount?: number;
  isDuplicate: boolean;
  onPick: () => void;
}) {
  return (
    <button
      className="btn"
      style={{
        display: "grid",
        gap: 2,
        textAlign: "left",
        padding: "8px 10px",
        border: `1px solid ${selected ? "var(--accent, #f57c1f)" : "var(--border, #555)"}`,
        background: selected ? "var(--accent-soft, rgba(245,124,31,0.16))" : undefined,
        cursor: "pointer",
        width: "100%",
      }}
      onClick={onPick}
    >
      <span style={{ fontSize: 13, fontWeight: 600 }}>
        {g.brand} <span style={{ fontSize: 11, color: "var(--text-dim, #aaa)" }}>({g.brandType === "exotic" ? "Exotic" : g.brandType === "gearset" ? "Gear-Set" : g.brandType === "named" ? "Named" : "High-End"}){g.prototype ? " · Prototyp" : ""}</span>
        {isDuplicate && (
          <span title="Identisches Duplikat im Inventar vorhanden" style={{ color: "var(--warn, #e6a23c)", marginLeft: 6 }}>
            ⚠ Duplikat
          </span>
        )}
      </span>
      <span style={{ fontSize: 12 }}>
        {gearShortLabel(g).split(" · ").slice(1).join(" · ")}
      </span>
      {g.talent && (
        <span style={{ fontSize: 11, color: "var(--text-dim, #aaa)" }}>Talent: {g.talent}</span>
      )}
    </button>
  );
}

function WeaponRow({
  w,
  selected,
  onPick,
}: {
  w: Weapon;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      className="btn"
      style={{
        display: "grid",
        gap: 2,
        textAlign: "left",
        padding: "8px 10px",
        border: `1px solid ${selected ? "var(--accent, #f57c1f)" : "var(--border, #555)"}`,
        background: selected ? "var(--accent-soft, rgba(245,124,31,0.16))" : undefined,
        cursor: "pointer",
        width: "100%",
      }}
      onClick={onPick}
    >
      <span style={{ fontSize: 13, fontWeight: 600 }}>
        {w.name}{" "}
        <span style={{ fontSize: 11, color: "var(--text-dim, #aaa)" }}>
          ({TYPE_LABELS[w.type]}
          {w.rarity === "exotic" ? ", Exotic" : w.rarity === "named" ? ", Named" : ""}
          {w.isPrototype ? " · Prototyp" : ""})
        </span>
      </span>
      <span style={{ fontSize: 12 }}>
        WD +{w.attributes.core1.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % · Grundschaden{" "}
        {w.baseDamage.toLocaleString("de-DE")} · {w.rpm} RPM · Magazin {w.magSize}
      </span>
      {w.talent && (
        <span style={{ fontSize: 11, color: "var(--text-dim, #aaa)" }}>Talent: {w.talent}</span>
      )}
    </button>
  );
}
