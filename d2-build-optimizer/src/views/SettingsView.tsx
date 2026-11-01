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

  const tabs: Array<{ key: SettingsSection; label: string }> = [
    { key: "appearance", label: t.settings.section.appearance },
    { key: "general", label: t.settings.section.general },
    { key: "data", label: t.settings.section.data },
    { key: "update", label: t.settings.section.update },
    { key: "about", label: t.settings.section.about },
  ];

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="tabs">
        {tabs.map((it) => (
          <button
            key={it.key}
            type="button"
            className={`tab ${section === it.key ? "active" : ""}`}
            onClick={() => setSection(it.key)}
            aria-current={section === it.key ? "page" : undefined}
          >
            {it.label}
          </button>
        ))}
      </div>

      {section === "appearance" && (
        <section className="field" style={{ display: "grid", gap: 4 }}>
          <div className="settings-group-title">{t.settings.section.appearance}</div>
          <div className="settings-row">
            <label>{t.settings.language}</label>
            <select value={lang} onChange={(e) => setLang(e.target.value as "de" | "en")}>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="settings-row">
            <label>{t.settings.theme}</label>
            <select
              value={store.theme}
              onChange={(e) => store.setTheme(e.target.value as "dark" | "light" | "system")}
            >
              <option value="dark">{t.settings.themes.dark}</option>
              <option value="light">{t.settings.themes.light}</option>
              <option value="system">{t.settings.themes.system}</option>
            </select>
          </div>
          <div className="settings-row">
            <label>{t.settings.numberFormat}</label>
            <select defaultValue="de">
              <option value="de">1.234.567,89</option>
              <option value="en">1,234,567.89</option>
            </select>
          </div>
        </section>
      )}

      {section === "general" && (
        <section className="field" style={{ display: "grid", gap: 4 }}>
          <div className="settings-group-title">{t.settings.section.general}</div>
          <div className="settings-row">
            <label>{t.settings.backups}</label>
            <input type="checkbox" defaultChecked />
          </div>
          <div className="settings-row">
            <label>{t.settings.updateCheck}</label>
            <input type="checkbox" defaultChecked />
          </div>
        </section>
      )}

      {section === "data" && (
        <section className="field" style={{ display: "grid", gap: 8 }}>
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
        </section>
      )}

      {section === "update" && (
        <section className="field" style={{ display: "grid", gap: 4 }}>
          <div className="settings-group-title">{t.settings.section.update}</div>
          <div className="settings-row">
            <label>{t.settings.updateCheck}</label>
            <input type="checkbox" defaultChecked />
          </div>
        </section>
      )}

      {section === "about" && (
        <section className="field" style={{ display: "grid", gap: 8 }}>
          <div className="settings-group-title">{t.settings.section.about}</div>
          <div>
            D2 Build Optimizer 0.1.0 · MVP 1.1 (Datenhaltung &amp; Inventar)
          </div>
          <p className="settings-hint">
            Lokale Anwendung ohne Telemetrie — alle Daten bleiben auf deinem Rechner.
          </p>
        </section>
      )}
    </div>
  );
}
