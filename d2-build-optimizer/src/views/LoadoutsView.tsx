import { useMemo, useState } from "react";
import { useStore } from "../store";
import { checkLoadoutIntegrity, buildCodeFromLoadout } from "../data/loadoutIntegrity";
import { ROLE_LABELS } from "../data/dashboardData";
import { DB_VERSION } from "../data/sampleData";
import type { Loadout } from "../data/sampleData";
import { DataTable } from "../components/DataTable";
import type { Column } from "../components/DataTable";

export function LoadoutsView({ embedded = false }: { embedded?: boolean }) {
  const store = useStore();
  const [sortKey, setSortKey] = useState<string>("timestamp");

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
    </div>
  );
}
