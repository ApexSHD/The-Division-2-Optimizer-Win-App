import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface PresetPickerProps<T> {
  label: string;
  items: T[];
  getItemLabel: (item: T) => string;
  getItemGroup: (item: T) => string;
  onPick: (item: T) => void;
  children?: ReactNode;
}

export function PresetPicker<T>({ label, items, getItemLabel, getItemGroup, onPick }: PresetPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const filtered = items.filter((it) => getItemLabel(it).toLowerCase().includes(query.trim().toLowerCase()));
    const map = new Map<string, T[]>();
    for (const it of filtered) {
      const g = getItemGroup(it);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(it);
    }
    return [...map.entries()];
  }, [items, query, getItemLabel, getItemGroup]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type="search"
          placeholder="Suchen…"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && (
          <div
            className="preset-dropdown"
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 30,
              maxHeight: 260,
              overflowY: "auto",
              background: "var(--bg-panel, #2a2a2e)",
              border: "1px solid var(--border, #555)",
              borderRadius: 6,
              marginTop: 2,
            }}
          >
            {groups.length === 0 && (
              <div style={{ padding: 8, fontSize: 12, color: "var(--text-dim, #aaa)" }}>Keine Treffer</div>
            )}
            {groups.map(([group, list]) => (
              <div key={group}>
                <div style={{ padding: "6px 8px 2px", fontSize: 11, fontWeight: 700, opacity: 0.7 }}>
                  {group}
                </div>
                {list.map((it, i) => (
                  <button
                    key={`${group}-${i}`}
                    type="button"
                    className="preset-option"
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 10px",
                      fontSize: 13,
                      background: "transparent",
                      border: "none",
                      color: "inherit",
                      cursor: "pointer",
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onPick(it);
                      setOpen(false);
                    }}
                  >
                    {getItemLabel(it)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
