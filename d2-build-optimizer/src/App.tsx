import { useContext, useEffect, useState } from "react";
import { StoreProvider, useStore } from "./store";
import { aggregateBuild } from "./data/damage";
import { I18nContext, I18nProvider } from "./i18n";
import type { Translation } from "./i18n/de";
import { GlobalView } from "./views/GlobalView";
import { WeaponsView } from "./views/WeaponsView";
import { GearView } from "./views/GearView";
import { CompareView } from "./views/CompareView";
import { OptimizerView } from "./views/OptimizerView";
import { AdminView } from "./views/AdminView";
import { SettingsView } from "./views/SettingsView";
import { DB_VERSION } from "./data/sampleData";

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

  const items: { id: typeof store.view; label: string; icon: string }[] = [
    { id: "global", label: t.nav.global, icon: "🌍" },
    { id: "weapons", label: t.nav.weapons, icon: "🔫" },
    { id: "gear", label: t.nav.gear, icon: "🧦" },
    { id: "optimizer", label: t.nav.optimizer, icon: "🎯" },
    { id: "compare", label: t.nav.compare, icon: "⚖" },
    { id: "admin", label: t.nav.admin, icon: "🗄" },
    { id: "settings", label: t.nav.settings, icon: "⚙" },
  ];

  return (
    <nav className="nav" aria-label="Hauptnavigation">
      {items.map((it) => (
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
    </nav>
  );
}

function ValuesSidebar() {
  const store = useStore();
  const { t } = useContext(I18nContext);

  if (!store.sidebarVisible) return null;

  return (
    <aside className="sidebar" aria-label={t.sidebar.title}>
      <h3>{t.sidebar.title}</h3>
      {(() => {
        const stats = aggregateBuild(store.gear, store.agent.shdLevel);
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
        const stats = aggregateBuild(store.gear, store.agent.shdLevel);
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
        Werden automatisch aus dem erfassten Inventar berechnet (mit der Berechnungs-Engine).
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
        {store.view === "global" && <GlobalView />}
        {store.view === "weapons" && <WeaponsView />}
        {store.view === "gear" && <GearView />}
        {store.view === "optimizer" && <OptimizerView />}
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
