import { useContext, useState } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";

type SettingsSection = "appearance" | "general" | "data" | "update" | "about";

export function SettingsView() {
  const store = useStore();
  const { t, lang, setLang } = useContext(I18nContext);
  const [changingDir, setChangingDir] = useState(false);
  const [section, setSection] = useState<SettingsSection>("appearance");

  async function onChangeStorageDir() {
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (!isTauri) {
      store.setStatus("Speicherort ändern nur in der Desktop-App möglich");
      return;
    }
    const input = prompt(
      "Neues Speicherverzeichnis (vollständiger Pfad):",
      store.storagePath ?? "",
    );
    if (!input || !input.trim()) return;
    setChangingDir(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const newDir = await invoke<string>("set_data_dir", { path: input.trim() });
      store.setStoragePath(newDir);
      const raw = await invoke<string | null>("load_user_data");
      if (raw !== null) {
        store.setStatus(`Speicherort geändert: ${newDir} (Daten übernommen)`);
      } else {
        store.setStatus(`Speicherort geändert: ${newDir} (leeres Inventar)`);
      }
    } catch (e) {
      store.setStatus(`Speicherort ändern fehlgeschlagen: ${e}`);
    } finally {
      setChangingDir(false);
    }
  }

  const navItems: Array<{ key: SettingsSection; icon: string; label: string }> = [
    { key: "appearance", icon: "🎨", label: t.settings.section.appearance },
    { key: "general", icon: "⚙️", label: t.settings.section.general },
    { key: "data", icon: "💾", label: t.settings.section.data },
    { key: "update", icon: "🔄", label: t.settings.section.update },
    { key: "about", icon: "ℹ️", label: t.settings.section.about },
  ];

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Einstellungs-Kategorien">
        {navItems.map((it) => (
          <button
            key={it.key}
            type="button"
            className={`settings-nav-item ${section === it.key ? "active" : ""}`}
            onClick={() => setSection(it.key)}
            aria-current={section === it.key ? "page" : undefined}
          >
            <span aria-hidden>{it.icon}</span>
            {it.label}
          </button>
        ))}
      </nav>

      <div className="settings-content">
        {section === "appearance" && (
          <>
            <h3 style={{ margin: "8px 0 4px" }}>{t.settings.section.appearance}</h3>
            <div className="settings-group-title">{t.settings.section.appearance}</div>
            <div className="settings-row">
              <label>{t.settings.language}</label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as "de" | "en")}
                aria-label={t.settings.language}
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="settings-row">
              <label>{t.settings.theme}</label>
              <select
                value={store.theme}
                onChange={(e) => store.setTheme(e.target.value as "dark" | "light" | "system")}
                aria-label={t.settings.theme}
              >
                <option value="dark">{t.settings.themes.dark}</option>
                <option value="light">{t.settings.themes.light}</option>
                <option value="system">{t.settings.themes.system}</option>
              </select>
            </div>
            <div className="settings-row">
              <label>{t.settings.numberFormat}</label>
              <select defaultValue="de" aria-label={t.settings.numberFormat}>
                <option value="de">1.234.567,89</option>
                <option value="en">1,234,567.89</option>
              </select>
            </div>
          </>
        )}

        {section === "general" && (
          <>
            <h3 style={{ margin: "8px 0 4px" }}>{t.settings.section.general}</h3>
            <div className="settings-group-title">{t.settings.section.general}</div>
            <div className="settings-row">
              <label>{t.settings.backups}</label>
              <input type="checkbox" defaultChecked aria-label={t.settings.backups} />
            </div>
            <div className="settings-row">
              <label>{t.settings.updateCheck}</label>
              <input type="checkbox" defaultChecked aria-label={t.settings.updateCheck} />
            </div>
          </>
        )}

        {section === "data" && (
          <>
            <h3 style={{ margin: "8px 0 4px" }}>{t.settings.section.data}</h3>
            <div className="settings-group-title">{t.settings.section.data}</div>
            <div className="settings-row">
              <label>{t.settings.storage}</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" readOnly value={store.storagePath ?? t.settings.storagePath} />
                <button className="btn" onClick={onChangeStorageDir} disabled={changingDir}>
                  {changingDir ? "Ändere…" : "Ändern…"}
                </button>
              </div>
            </div>
            <p className="settings-hint">
              Die Benutzerdaten liegen als „user-data.json" in diesem Verzeichnis (inkl. .bak-Sicherung).
              Beim Ändern werden vorhandene Daten übernommen, falls im neuen Verzeichnis noch keine liegen.
            </p>
          </>
        )}

        {section === "update" && (
          <>
            <h3 style={{ margin: "8px 0 4px" }}>{t.settings.section.update}</h3>
            <div className="settings-group-title">{t.settings.section.update}</div>
            <div className="settings-row">
              <label>{t.settings.updateCheck}</label>
              <input type="checkbox" defaultChecked aria-label={t.settings.updateCheck} />
            </div>
          </>
        )}

        {section === "about" && (
          <>
            <h3 style={{ margin: "8px 0 4px" }}>{t.settings.section.about}</h3>
            <div className="settings-group-title">{t.settings.section.about}</div>
            <div className="settings-row">
              <span>D2 Build Optimizer 0.1.0 · MVP 1.1 (Datenhaltung &amp; Inventar)</span>
            </div>
            <p className="settings-hint">
              Lokale Anwendung ohne Telemetrie — alle Daten bleiben auf deinem Rechner.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
