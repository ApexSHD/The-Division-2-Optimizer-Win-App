import { useMemo, useState, useEffect } from "react";
import { useStore } from "../store";
import {
  computeInventoryKpis,
  roleKings,
  randomBuildTip,
  type RoleKing,
  type BuildTip,
} from "../data/dashboardData";
import { checkLoadoutIntegrity } from "../data/loadoutIntegrity";
import { DB_VERSION } from "../data/sampleData";
import type { Loadout } from "../data/sampleData";

function Tile({
  title,
  children,
  action,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section
      className="field"
      style={{
        margin: 0,
        borderRadius: 8,
        padding: 12,
        display: "grid",
        gap: 8,
        border: "1px solid var(--border, #555)",
        gridColumn: wide ? "span 2" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 13 }}>{title}</strong>
        <span className="spacer" />
        {action}
      </div>
      {children}
    </section>
  );
}

function KpiStat({ label, value, hint, title }: { label: string; value: string; hint?: string; title?: string }) {
  return (
    <div title={title} style={{ border: "1px solid var(--border, #555)", borderRadius: 6, padding: "6px 10px", minWidth: 110 }}>
      <div style={{ fontSize: 11, color: "var(--text-dim, #aaa)" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
      {hint && <div style={{ fontSize: 10, color: "var(--text-dim, #aaa)" }}>{hint}</div>}
    </div>
  );
}

export function DashboardView() {
  const store = useStore();
  const [tipSeed, setTipSeed] = useState<number>(() => Math.floor(Math.random() * 1000));

  useEffect(() => {
    document.title = "Dashboard — The Division 2 Optimizer";
  }, []);

  const kpis = useMemo(
    () => computeInventoryKpis(store.gear, store.weapons, store.builds),
    [store.gear, store.weapons, store.builds],
  );
  const kings = useMemo(() => roleKings(store.builds), [store.builds]);
  const tip = useMemo(
    () => randomBuildTip(store.gear, tipSeed),
    [store.gear, tipSeed],
  ) as BuildTip;
  const recentLoadouts = useMemo(
    () =>
      [...store.builds]
        .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""))
        .slice(0, 5),
    [store.builds],
  );

  const renderLoadout = (b: Loadout) => {
    const integrity = checkLoadoutIntegrity(b, store.weapons, store.gear, DB_VERSION);
    return (
      <div key={b.id} style={{ fontSize: 12, display: "grid", gap: 2 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <strong>{b.name}</strong>
          {integrity.outdated ? (
            <span title={integrity.reasons.join(" · ")} style={{ color: "var(--warn, #e6a23c)" }}>
              ⚠
            </span>
          ) : (
            <span style={{ color: "var(--ok, #67c23a)" }}>✓</span>
          )}
        </div>
        <div style={{ color: "var(--text-dim, #aaa)" }}>
          DPS {Math.round(b.metrics.dps).toLocaleString("de-DE")} · CHC{" "}
          {b.metrics.chc.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % · Rüstung{" "}
          {Math.round(b.metrics.armor).toLocaleString("de-DE")}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <section className="field" style={{ margin: 0 }}>
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        <p style={{ margin: 0, color: "var(--text-dim, #aaa)", fontSize: 13 }}>
          Alles auf einen Blick: Inventar, Lücken, Loadouts und Datenstatus.
        </p>
      </section>

      {/* 3.1 + 3.5: KPI-Zeile */}
      <Tile title="📦 Inventar-Überblick">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <KpiStat label="Gear-Teile" value={String(kpis.gearTotal)} />
          <KpiStat label="Waffen" value={String(kpis.weaponTotal)} />
          <KpiStat label="Exotics (Gear)" value={String(kpis.exoticGear)} />
          <KpiStat
            label="Top-Teile (≥ 90 % Max)"
            value={String(kpis.topParts.reduce((acc, t) => acc + t.topCount, 0))}
            hint={kpis.topParts.map((t) => `${t.topCount}× ${t.label.split(" (")[0]}`).join(", ") || "—"}
          />
          <KpiStat
            label="Safe-to-Junk"
            value={String(kpis.zeroUsageGearIds.length + kpis.zeroUsageWeaponIds.length)}
            title="Teile, die in keinem gespeicherten Loadout verwendet werden"
            hint={`${kpis.zeroUsageGearIds.length} Gear · ${kpis.zeroUsageWeaponIds.length} Waffen`}
          />
        </div>
        <div style={{ fontSize: 12, display: "grid", gap: 2 }}>
          {kpis.slots.map((s) => (
            <div key={s.slot} style={{ display: "flex", gap: 8 }}>
              <span style={{ width: 90 }}>{s.slot}:</span>
              <span>{s.count} Teile</span>
              <span style={{ color: "var(--text-dim, #aaa)" }}>
                (🔴 {s.cores.rot} · 🔵 {s.cores.blau} · 🟡 {s.cores.gelb})
              </span>
            </div>
          ))}
        </div>
        {(kpis.gearsets.length > 0 || kpis.brands.length > 0) && (
          <div style={{ fontSize: 12 }}>
            <strong>Sets/Marken:</strong>{" "}
            {kpis.gearsets.map((gs) => `${gs.name} (${gs.count})`).join(", ")}
            {kpis.gearsets.length > 0 && kpis.brands.length > 0 ? " | " : ""}
            {kpis.brands.map((gs) => `${gs.name} (${gs.count})`).join(", ")}
          </div>
        )}
      </Tile>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12 }}>
        {/* Linke Spalte */}
        <div style={{ display: "grid", gap: 12 }}>
          {/* 3.2: Lückenanalyse & Ziel-Farming */}
          <Tile
            title="🎯 Lückenanalyse & Ziel-Farming"
            action={
              <button className="btn" style={{ fontSize: 11 }} onClick={() => store.setView("optimizer")}>
                Im Optimierer prüfen
              </button>
            }
          >
            <div style={{ fontSize: 12, color: "var(--text-dim, #aaa)" }}>
              Die priorisierte Farm-Liste mit Fundorten wird im Optimierer berechnet (Tab
              „Verbesserungen“ nach einer Rollen-Berechnung) — hier die letzte Übersicht deiner
              gespeicherten Loadouts mit Abgleich gegen das Inventar:
            </div>
            {store.builds.length === 0 ? (
              <div style={{ fontSize: 12 }}>
                Noch keine Loadouts gespeichert — im Optimierer nach einer Berechnung „Als Loadout
                speichern" nutzen.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {store.builds.slice(0, 4).map((b) => {
                  const integrity = checkLoadoutIntegrity(b, store.weapons, store.gear, DB_VERSION);
                  return (
                    <div key={b.id} style={{ fontSize: 12 }}>
                      <strong>{b.name}</strong>{" "}
                      {integrity.outdated ? (
                        <span style={{ color: "var(--warn, #e6a23c)" }}>
                          — {integrity.reasons.join(" · ")}
                        </span>
                      ) : (
                        <span style={{ color: "var(--ok, #67c23a)" }}>— vollständig im Inventar</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Tile>

          {/* 3.3: Builds & Loadouts */}
          <Tile
            title="🧱 Deine Builds & Loadouts"
            action={
              <button className="btn" style={{ fontSize: 11 }} onClick={() => store.setView("compare")}>
                Alle vergleichen
              </button>
            }
          >
            {recentLoadouts.length === 0 ? (
              <div style={{ fontSize: 12 }}>Noch keine Loadouts — erst im Optimierer speichern.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {recentLoadouts.map(renderLoadout)}
              </div>
            )}
            {kings.length > 0 && (
              <div style={{ display: "grid", gap: 4, fontSize: 12, borderTop: "1px solid var(--border, #555)", paddingTop: 8 }}>
                <strong>Rollen-Könige:</strong>
                {kings.map((k: RoleKing) => (
                  <div key={k.roleId}>
                    {k.roleLabel}: <strong>{k.loadout?.name ?? "—"}</strong>{" "}
                    {k.loadout && `(${Math.round(k.loadout.metrics.dps).toLocaleString("de-DE")} DPS)`}
                  </div>
                ))}
              </div>
            )}
          </Tile>
        </div>

        {/* Rechte Spalte */}
        <div style={{ display: "grid", gap: 12 }}>
          {/* 3.4: Schnellaktionen */}
          <Tile title="⚡ Schnellaktionen">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => store.setView("weapons")}>
                📥 Inventar importieren
              </button>
              <button className="btn btn-accent" onClick={() => store.setView("optimizer")}>
                🎯 Optimierer starten
              </button>
              <button className="btn" onClick={() => store.setView("compare")}>
                ⚖️ Builds vergleichen
              </button>
            </div>
          </Tile>

          {/* 3.5: Zustand der Daten */}
          <Tile title="💾 Zustand der Daten">
            <div style={{ fontSize: 12, display: "grid", gap: 4 }}>
              <div>
                Letzter Import:{" "}
                {store.lastImportAt
                  ? new Date(store.lastImportAt).toLocaleString("de-DE")
                  : "noch kein Import in dieser Sitzung"}
              </div>
              <div>Datenbank-Version: {DB_VERSION}</div>
              {store.importWarnings.length > 0 ? (
                <div style={{ color: "var(--warn, #e6a23c)" }}>
                  ⚠ {store.importWarnings.length} Hinweis(e) beim letzten Import:
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {store.importWarnings.slice(0, 3).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div style={{ color: "var(--ok, #67c23a)" }}>✓ Keine Warnungen beim letzten Import</div>
              )}
            </div>
          </Tile>

          {/* 3.6: Extras & Analytics */}
          <Tile title="📊 Verteilung & Build-Tipp">
            {store.builds.length > 0 ? (
              <div style={{ display: "grid", gap: 4 }}>
                {store.builds.slice(0, 6).map((b) => (
                  <div key={b.id} style={{ fontSize: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{b.name}</span>
                      <span style={{ color: "var(--text-dim, #aaa)" }}>
                        Rüst {Math.round(b.metrics.armor).toLocaleString("de-DE")} · WD{" "}
                        {b.metrics.wd.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % · CHC{" "}
                        {b.metrics.chc.toLocaleString("de-DE", { maximumFractionDigits: 0 })} %
                      </span>
                    </div>
                    <div style={{ display: "flex", height: 6, gap: 1, marginTop: 2 }}>
                      {(() => {
                        const maxArmor = Math.max(...store.builds.map((x) => x.metrics.armor), 1);
                        const maxWd = Math.max(...store.builds.map((x) => x.metrics.wd), 1);
                        return (
                          <>
                            <div style={{ width: `${(100 * b.metrics.armor) / maxArmor}%`, background: "#4f9cf9", borderRadius: 2 }} />
                            <div style={{ width: `${(100 * b.metrics.wd) / maxWd}%`, background: "#67c23a", borderRadius: 2 }} />
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ))}
                <small style={{ color: "var(--text-dim, #aaa)" }}>
                  Blau: Rüstung relativ zum Maximum · Grün: Waffenschaden relativ zum Maximum
                </small>
              </div>
            ) : (
              <div style={{ fontSize: 12 }}>
                Verteilungs-Grafik erscheint, sobald Loadouts gespeichert sind.
              </div>
            )}
            <div
              style={{
                border: "1px dashed var(--border, #555)",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 12,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span>💡 {tip.text}</span>
              <button
                className="btn"
                style={{ fontSize: 10, padding: "2px 8px" }}
                onClick={() => setTipSeed((s) => s + 1)}
                title="Anderen Tipp anzeigen"
              >
                ↻
              </button>
            </div>
          </Tile>
        </div>
      </div>
    </div>
  );
}
