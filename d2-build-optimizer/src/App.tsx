import { useContext, useEffect, useState } from "react";
import { StoreProvider, useStore } from "./store";
import { aggregateBuild } from "./data/damage";
import { I18nContext, I18nProvider } from "./i18n";
import type { Translation } from "./i18n/de";
import type { GearPiece } from "./data/sampleData";
import { GlobalView } from "./views/GlobalView";
import { DashboardView } from "./views/DashboardView";
import { LoadoutsView } from "./views/LoadoutsView";
import { WeaponsView } from "./views/WeaponsView";
import { GearView } from "./views/GearView";
import { CompareView } from "./views/CompareView";
import { OptimizerView } from "./views/OptimizerView";
import { AdminView } from "./views/AdminView";
import { SettingsView } from "./views/SettingsView";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { DB_VERSION } from "./data/sampleData";
import { checkLoadoutIntegrity } from "./data/loadoutIntegrity";

function useThemeEffect() {
  const store = useStore();
  useEffect(() => {
    const root = document.documentElement;
    function apply(theme: string) {
      root.setAttribute("data-theme", theme);
    }
    if (store.theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches ? "dark" : "light");
      const handler = (e: MediaQueryListEvent) => apply(e.matches ? "dark" : "light");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    apply(store.theme);
  }, [store.theme]);
}

function TitleBar({ t }: { t: Translation }) {
  const store = useStore();
  const [newProfile, setNewProfile] = useState("");

  async function onMinimize() {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch { /* Browser-Dev-Modus */ }
  }

  async function onToggleMaximize() {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().toggleMaximize();
    } catch { /* Browser-Dev-Modus */ }
  }

  async function onClose() {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch { /* Browser-Dev-Modus */ }
  }

  async function startDrag() {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().startDragging();
    } catch { /* Browser-Dev-Modus */ }
  }

  function addProfile() {
    const name = newProfile.trim();
    if (!name) return;
    store.addProfile(name);
    setNewProfile("");
  }

  return (
    <div className="titlebar">
      <div className="titlebar-drag" onMouseDown={startDrag}>
        <span className="titlebar-title">🏝 {t.appName}</span>
        <select
          aria-label={t.global.profile}
          value={store.activeProfileId}
          onChange={(e) => store.setActiveProfile(e.target.value)}
          style={{ fontSize: 12 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {store.profiles.map((p) => (
            <option key={p.id} value={p.id}>Profil: {p.name}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="+ Profil"
          value={newProfile}
          onChange={(e) => setNewProfile(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addProfile();
          }}
          onBlur={() => setNewProfile("")}
          style={{ width: 90, fontSize: 12 }}
          onMouseDown={(e) => e.stopPropagation()}
        />
        {store.profiles.length > 1 && (
          <button
            className="btn"
            style={{ fontSize: 11, padding: "2px 8px" }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (confirm("Profil löschen?")) store.removeProfile(store.activeProfileId);
            }}
          >
            ✕
          </button>
        )}
        <input type="search" placeholder={`${t.common.search}… (Strg+F)`} style={{ width: 180, fontSize: 12 }} readOnly onFocus={(e) => e.target.blur()} />
      </div>
      <div className="titlebar-btns">
        <button className="titlebar-btn" onClick={onMinimize} aria-label="Minimieren">
          ─
        </button>
        <button className="titlebar-btn" onClick={onToggleMaximize} aria-label="Maximieren">
          ▢
        </button>
        <button className="titlebar-btn close" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
      </div>
    </div>
  );
}

function Nav() {
  const store = useStore();
  const { t } = useContext(I18nContext);

  type NavEntry = { id: typeof store.view; label: string; icon: string };
  type NavGroup = { title: string | null; entries: NavEntry[] };
  const groups: NavGroup[] = [
    {
      title: null,
      entries: [{ id: "dashboard", label: "Startseite", icon: "\ud83c\udfe0" }],
    },
    {
      title: "Inventar",
      entries: [
        { id: "weapons", label: t.nav.weapons, icon: "\ud83d\udd2b" },
        { id: "gear", label: t.nav.gear, icon: "\ud83e\udde6" },
      ],
    },
    {
      title: "Optimierung",
      entries: [
        { id: "optimizer", label: t.nav.optimizer, icon: "\ud83c\udfaf" },
        { id: "loadouts", label: "Loadouts", icon: "\ud83e\uddf1" },
        { id: "compare", label: t.nav.compare, icon: "\u2696" },
      ],
    },
    {
      title: "Einstellungen",
      entries: [
        { id: "global", label: t.nav.global, icon: "\ud83c\udf0d" },
        { id: "admin", label: t.nav.admin, icon: "\ud83d\uddc3" },
        { id: "settings", label: t.nav.settings, icon: "\u2699" },
      ],
    },
  ];

  return (
    <nav className="nav" aria-label="Hauptnavigation">
      {groups.map((group, gi) => (
        <div key={group.title ?? `group-${gi}`} className="nav-group">
          {group.title && <div className="nav-group-title">{group.title}</div>}
          {group.entries.map((it) => (
            <button
              key={it.id}
              className={`nav-item ${store.view === it.id ? "active" : ""}`}
              onClick={() => store.setView(it.id)}
              aria-current={store.view === it.id ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden>{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}

function ValuesSidebar() {
  const store = useStore();
  const { t } = useContext(I18nContext);

  if (!store.sidebarVisible) return null;

  const activeBuild = store.builds.find((b) => b.id === store.activeBuildId) ?? null;
  const buildGear = activeBuild
    ? Object.values(activeBuild.gearIds)
        .map((gid) => store.gear.find((g) => g.id === gid))
        .filter((g): g is GearPiece => Boolean(g))
    : [];
  const statsSource = buildGear.length > 0 ? buildGear : store.gear;
  const sourceLabel =
    buildGear.length > 0
      ? `Loadout: ${activeBuild?.name ?? ""}`
      : "Gesamtes Inventar (noch kein Loadout ausgewählt — im Optimierer „Als Loadout speichern“ nutzen)";

  return (
    <aside className="sidebar" aria-label={t.sidebar.title}>
      <h3>{t.sidebar.title}</h3>
      <div className="stat" style={{ fontSize: 11, color: "var(--text-dim, #aaa)" }}>{sourceLabel}</div>
      {activeBuild && (() => {
        const integrity = checkLoadoutIntegrity(activeBuild, store.weapons, store.gear, DB_VERSION);
        if (!integrity.outdated) return null;
        return (
          <div
            style={{
              border: "1px solid var(--warn, #e6a23c)",
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 11,
              background: "rgba(230,162,60,0.08)",
            }}
            title="Teile wurden gelöscht/geändert oder die Datenbank wurde aktualisiert"
          >
            ⚠ Loadout veraltet: {integrity.reasons.join(" · ")}
          </div>
        );
      })()}
      {(() => {
        const stats = aggregateBuild(statsSource, store.agent.shdLevel);
        return (
          <>
            <div className="stat">
              <div className="stat-label">{t.sidebar.chc}</div>
              <div className="stat-value accent">{stats.chc.toLocaleString("de-DE")} %</div>
            </div>
            <div className="stat">
              <div className="stat-label">{t.sidebar.chd}</div>
              <div className="stat-value accent">+{stats.chd.toLocaleString("de-DE")} %</div>
            </div>
            <div className="stat">
              <div className="stat-label">{t.sidebar.wd}</div>
              <div className="stat-value accent">+{stats.wd.toLocaleString("de-DE")} %</div>
            </div>
          </>
        );
      })()}
      <div className="stat">
        <div className="stat-label">{t.sidebar.dps}</div>
        <div className="stat-value">—</div>
      </div>
      <div className="stat">
        <div className="stat-label">{t.sidebar.armor}</div>
        <div className="stat-value">—</div>
      </div>
      <h3>Wertzusammensetzung</h3>
      {(() => {
        const stats = aggregateBuild(sourceLabel ? statsSource : store.gear, store.agent.shdLevel);
        const src = (key: string) => stats.sources[key] ?? [];
        const renderSources = (key: string) => {
          const list = src(key);
          if (list.length === 0) return <div className="stat" style={{ fontSize: 11, color: "var(--text-faint)" }}>—</div>;
          return (
            <details className="stat" style={{ padding: "6px 10px" }}>
              <summary style={{ cursor: "pointer", fontSize: 11 }}>{list.length} Quelle(n)</summary>
              <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0", fontSize: 11 }}>
                {list.map((s2, i) => (
                  <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{s2.label}</span>
                    <span>+{s2.value.toLocaleString("de-DE")}</span>
                  </li>
                ))}
              </ul>
            </details>
          );
        };
        return (
          <>
            <div className="set-bonus">CHC {stats.chc.toLocaleString("de-DE")} %</div>
            {renderSources("chc")}
            <div className="set-bonus">WD +{stats.wd.toLocaleString("de-DE")} %</div>
            {renderSources("wd")}
            <div className="set-bonus">CHD +{stats.chd.toLocaleString("de-DE")} %</div>
            {renderSources("chd")}
          </>
        );
      })()}
      <h3>{t.sidebar.setBonuses}</h3>
      <div className="set-bonus" style={{ opacity: 0.6 }}>
        Berechnet für das oben genannte Loadout bzw. Inventar (mit der Berechnungs-Engine).
      </div>
    </aside>
  );
}

function StatusBar() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  return (
    <footer className="statusbar">
      <span>{t.status.dbVersion}: {store.db ? `${store.db.versions.weapons} · ${store.db.versions.gear} · ${store.db.versions.mods}` : DB_VERSION}</span>
      <span>
        {store.loadError
          ? `⚠ ${t.status.storageOk}: ${store.loadError}`
          : store.storagePath
            ? `💾 ${store.storagePath}`
            : t.status.storageOk}
      </span>
      {store.progress !== null && <span>{t.status.calculating} {store.progress} %</span>}
      <span className="spacer" />
      <span>{store.status}</span>
    </footer>
  );
}

function WorkArea() {
  const store = useStore();
  const { t } = useContext(I18nContext);

  const titles: Record<typeof store.view, { title: string; sub: string }> = {
    dashboard: { title: "Dashboard", sub: "Inventar, Lücken, Loadouts und Datenstatus auf einen Blick" },
    loadouts: { title: "Loadouts", sub: "Alle gespeicherten Builds mit ihren Werten" },
    global: { title: t.global.title, sub: t.global.subtitle },
    weapons: { title: t.weapons.title, sub: t.weapons.subtitle },
    gear: { title: t.gear.title, sub: t.gear.subtitle },
    optimizer: { title: "Build-Optimierung V4", sub: "Ziele, Fragebogen, Wirkungsvektor" },
    compare: { title: t.compare.title, sub: t.compare.subtitle },
    admin: { title: t.admin.title, sub: t.admin.subtitle },
    settings: { title: t.settings.title, sub: t.settings.subtitle },
  };

  const current = titles[store.view];

  return (
    <main className="workarea">
      <div className="workarea-header">
        <h1 className="workarea-title">{current.title}</h1>
        <div className="workarea-sub">{current.sub}</div>
      </div>
      <div className="workarea-content">
        {store.view === "dashboard" && <DashboardView />}
        {store.view === "global" && <GlobalView />}
        {store.view === "weapons" && <WeaponsView />}
        {store.view === "gear" && <GearView />}
        {store.view === "optimizer" && <OptimizerView />}
        {store.view === "loadouts" && <LoadoutsView />}
        {store.view === "compare" && <CompareView />}
        {store.view === "admin" && <AdminView />}
        {store.view === "settings" && <SettingsView />}
      </div>
    </main>
  );
}

function Shell() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  useThemeEffect();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F5") {
        e.preventDefault();
        store.setView("global");
      } else if (e.key === "F9") {
        e.preventDefault();
        store.toggleSidebar();
      } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        store.setStatus(`${t.common.search}: Strg+F (Platzhalter)`);
      } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        store.setStatus("Strg+N: neu (Platzhalter)");
      } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        store.setStatus("Strg+S: gespeichert (Platzhalter)");
      } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (store.canUndo) store.undo();
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (store.canRedo) store.redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, t]);

  return (
    <>
      <TitleBar t={t} />
      <div className="app-body">
        <Nav />
        <WorkArea />
        <ValuesSidebar />
      </div>
      <StatusBar />
      {!store.onboardingDone && store.weapons.length === 0 && store.gear.length === 0 && (
        <OnboardingWizard />
      )}
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <I18nProvider>
        <Shell />
      </I18nProvider>
    </StoreProvider>
  );
}
