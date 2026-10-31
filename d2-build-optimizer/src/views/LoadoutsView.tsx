import { useMemo, useState } from "react";
import { useStore } from "../store";
import { checkLoadoutIntegrity, buildCodeFromLoadout } from "../data/loadoutIntegrity";
import { ROLE_LABELS } from "../data/dashboardData";
import { DB_VERSION } from "../data/sampleData";
import type { Loadout } from "../data/sampleData";
import { DataTable } from "../components/DataTable";
import type { Column } from "../components/DataTable";
import { SidePanel } from "../components/SidePanel";
import { gearShortLabel, weaponShortLabel } from "../data/itemLabels";

export function LoadoutsView({ embedded = false }: { embedded?: boolean }) {
  const store = useStore();
  const [sortKey, setSortKey] = useState<string>("timestamp");
  const [editing, setEditing] = useState<Loadout | null>(null);

  const rows = useMemo(
    () =>
      [...store.builds].sort((a, b) => {
        if (sortKey === "name") return a.name.localeCompare(b.name);
        if (sortKey === "dps") return b.metrics.dps - a.metrics.dps;
        return (b.timestamp ?? "").localeCompare(a.timestamp ?? "");
      }),
    [store.builds, sortKey],
  );

  const setActive = (b: Loadout) => {
    store.setActiveBuildId(b.id);
    store.setStatus(`„${b.name}" als aktuell getragen festgelegt`);
  };

  const copyCode = (b: Loadout) => {
    const { code } = buildCodeFromLoadout(b, store.weapons, store.gear);
    navigator.clipboard?.writeText(code).then(
      () => store.setStatus(`Build-Code kopiert: ${code.slice(0, 24)}…`),
      () => store.setStatus(`Build-Code: ${code}`),
    );
  };

  const weaponOf = (b: Loadout) => store.weapons.find((w) => w.id === b.weaponIds[0]) ?? null;
  const gearOf = (b: Loadout) =>
    (Object.values(b.gearIds) as (string | undefined)[])
      .map((gid) => store.gear.find((g) => g.id === gid))
      .filter((g): g is NonNullable<typeof g> => Boolean(g));
  const weaponModsOf = (b: Loadout) => b.weaponMods ?? [];
  const gearModOf = (b: Loadout, gearId: string) => b.gearMods?.[gearId] ?? null;

  const saveEdit = () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      store.setStatus("Name fehlt — bitte Namen angeben.");
      return;
    }
    store.updateBuild({ ...editing, name: editing.name.trim() });
    store.setStatus(`„${editing.name.trim()}" aktualisiert`);
    setEditing(null);
  };

  const removeLoadout = (b: Loadout) => {
    if (!confirm(`Loadout „${b.name}" löschen?`)) return;
    store.removeBuild(b.id);
    store.setStatus(`„${b.name}" gelöscht`);
  };

  const columns: Column<Loadout>[] = [
    {
      key: "name",
      label: "Name",
      render: (b) => (
        <strong>
          {b.name}
          {store.activeBuildId === b.id && (
            <span className="badge gearset" style={{ marginLeft: 6 }} title="Aktuell getragen">
              Getragen
            </span>
          )}
        </strong>
      ),
      sortValue: (b) => b.name,
    },
    {
      key: "role",
      label: "Rolle",
      render: (b) => ROLE_LABELS[b.roleId] ?? (b.roleId || "—"),
      sortValue: (b) => b.roleId,
    },
    {
      key: "dps",
      label: "DPS",
      render: (b) => Math.round(b.metrics.dps).toLocaleString("de-DE"),
      sortValue: (b) => b.metrics.dps,
    },
    {
      key: "chc",
      label: "CHC",
      render: (b) => `${b.metrics.chc.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`,
      sortValue: (b) => b.metrics.chc,
    },
    {
      key: "chd",
      label: "CHD",
      render: (b) => `+${b.metrics.chd.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`,
      sortValue: (b) => b.metrics.chd,
    },
    {
      key: "wd",
      label: "WD",
      render: (b) => `+${b.metrics.wd.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`,
      sortValue: (b) => b.metrics.wd,
    },
    {
      key: "armor",
      label: "Rüstung",
      render: (b) => Math.round(b.metrics.armor).toLocaleString("de-DE"),
      sortValue: (b) => b.metrics.armor,
    },
    {
      key: "status",
      label: "Status",
      render: (b) => {
        const integrity = checkLoadoutIntegrity(b, store.weapons, store.gear, DB_VERSION);
        return integrity.outdated ? (
          <span title={integrity.reasons.join(" · ")} style={{ color: "var(--warn, #e6a23c)" }}>
            ⚠ Veraltet
          </span>
        ) : (
          <span style={{ color: "var(--ok, #67c23a)" }}>✓ Aktuell</span>
        );
      },
      sortValue: (b) => (checkLoadoutIntegrity(b, store.weapons, store.gear, DB_VERSION).outdated ? "1" : "0"),
    },
    {
      key: "date",
      label: "Gespeichert",
      render: (b) => (b.timestamp ? new Date(b.timestamp).toLocaleDateString("de-DE") : "—"),
      sortValue: (b) => b.timestamp ?? "",
    },
    {
      key: "details",
      label: "Teile & Mods",
      render: (b) => {
        const w = weaponOf(b);
        const gear = gearOf(b);
        const wMods = weaponModsOf(b);
        return (
          <details style={{ whiteSpace: "normal" }}>
            <summary style={{ cursor: "pointer", fontSize: 12 }}>
              {gear.length} Gear-Teil(e){w ? " · 1 Waffe" : ""}{wMods.length > 0 ? ` · ${wMods.length} Waffen-Mod(s)` : ""}
            </summary>
            <div style={{ fontSize: 11, display: "grid", gap: 3, marginTop: 4 }}>
              {w ? (
                <div>
                  <strong>{weaponShortLabel(w)}</strong>
                  {wMods.length > 0 && (
                    <div style={{ color: "var(--text-dim, #aaa)", paddingLeft: 10 }}>
                      Mods:{" "}
                      {wMods
                        .map((m) => `${m.dbName ?? m.slot} (+${m.value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % ${m.attr})`)
                        .join(" · ")}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: "var(--warn, #e6a23c)" }}>Waffe nicht mehr im Inventar</div>
              )}
              {gear.map((g) => {
                const mod = gearModOf(b, g.id);
                return (
                  <div key={g.id}>
                    {gearShortLabel(g)}
                    {mod && (
                      <span style={{ color: "var(--text-dim, #aaa)" }}>
                        {" "}· Mod: {mod.attr.toUpperCase()} +{mod.value.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        );
      },
      sortValue: () => "",
    },
  ];

  return (
    <div style={embedded ? { margin: 0 } : undefined}>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(b) => b.id}
        searchPlaceholder="Loadouts suchen…"
        filterFn={(b, q) =>
          b.name.toLowerCase().includes(q) || (ROLE_LABELS[b.roleId] ?? b.roleId).toLowerCase().includes(q)
        }
        rowActions={[
          {
            label: "★",
            title: "Als aktuell getragen festlegen",
            onAction: (b) => setActive(b),
          },
          { label: "⚖", title: "Im Vergleich öffnen", onAction: () => store.setView("compare") },
          { label: "📋", title: "Build-Code kopieren", onAction: (b) => copyCode(b) },
          { label: "✎", title: "Loadout bearbeiten", onAction: (b) => setEditing({ ...b }) },
          { label: "✕", title: "Loadout löschen", className: "btn-danger", onAction: (b) => removeLoadout(b) },
        ]}
        toolbar={
          <>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
              Sortierung
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                <option value="timestamp">Zuletzt gespeichert</option>
                <option value="dps">DPS (absteigend)</option>
                <option value="name">Name</option>
              </select>
            </label>
            <span className="spacer" />
            <span style={{ fontSize: 12, color: "var(--text-dim, #aaa)" }}>
              {store.builds.length} Loadout(s) · Δ-Angaben im Optimierer beziehen sich auf das
              „getragene" Loadout
            </span>
          </>
        }
      />

      <SidePanel
        open={editing !== null}
        title={editing ? `Loadout bearbeiten: ${editing.name}` : "Loadout bearbeiten"}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn" onClick={() => setEditing(null)}>Abbrechen</button>
            <span className="spacer" />
            <button className="btn btn-accent" onClick={saveEdit}>Speichern</button>
          </>
        }
      >
        {editing && (
          <>
            <div className="field">
              <label>Name</label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                style={{ width: "100%" }}
              />
            </div>
            <div className="field">
              <label>Notiz</label>
              <input
                type="text"
                value={editing.note}
                onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                style={{ width: "100%" }}
              />
            </div>

            {(editing.weaponMods ?? []).length > 0 && (
              <div className="field">
                <label>Waffen-Mods (Werte anpassen / entfernen)</label>
                {(editing.weaponMods ?? []).map((m, i) => (
                  <div key={`${m.slot}-${i}`} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap", fontSize: 13 }}>
                    <span style={{ minWidth: 80 }}>{m.slot}</span>
                    <span style={{ color: "var(--text-dim, #aaa)", minWidth: 150 }}>
                      {m.dbName ?? m.attr} ({m.attr})
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={m.value}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          weaponMods: (editing.weaponMods ?? []).map((x, xi) =>
                            xi === i ? { ...x, value: Math.max(0, Number(e.target.value)) } : x,
                          ),
                        })
                      }
                      style={{ width: 80 }}
                    />
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: 11, padding: "2px 8px" }}
                      onClick={() =>
                        setEditing({
                          ...editing,
                          weaponMods: (editing.weaponMods ?? []).filter((_, xi) => xi !== i),
                        })
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {editing.gearMods && Object.keys(editing.gearMods).length > 0 && (
              <div className="field">
                <label>Gear-Mods (Werte anpassen / entfernen)</label>
                {Object.entries(editing.gearMods ?? {}).map(([gid, modMaybe]) => {
                  const mod = modMaybe!;
                  const g = store.gear.find((x) => x.id === gid);
                  return (
                    <div key={gid} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap", fontSize: 13 }}>
                      <span style={{ color: "var(--text-dim, #aaa)", minWidth: 200 }}>
                        {g ? `${g.brand} (${g.slot})` : gid}
                      </span>
                      <span>{mod.attr.toUpperCase()}</span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={mod.value}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            gearMods: {
                              ...editing.gearMods,
                              [gid]: { attr: mod.attr, value: Math.max(0, Number(e.target.value)) },
                            },
                          })
                        }
                        style={{ width: 80 }}
                      />
                      <button
                        className="btn btn-danger"
                        style={{ fontSize: 11, padding: "2px 8px" }}
                        onClick={() => {
                          const next = { ...editing.gearMods };
                          delete next[gid];
                          setEditing({ ...editing, gearMods: next });
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="settings-hint">
              Gear-Teile und Waffe werden über die Referenzen auf dein Inventar gehalten — das
              Loadout aktualisiert sich automatisch mit, wenn Teile geändert werden (Veraltungs-Hinweis
              zeigt Abweichungen). Werte der zugeordneten Mods lassen sich hier korrigieren.
            </p>
          </>
        )}
      </SidePanel>
    </div>
  );
}
