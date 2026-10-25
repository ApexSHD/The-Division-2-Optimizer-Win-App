import { useContext, useState } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";

export function SettingsView() {
  const store = useStore();
  const { t, lang, setLang } = useContext(I18nContext);
  const [changingDir, setChangingDir] = useState(false);

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

  return (
    <div style={{ maxWidth: 640 }}>
      <h3>{t.settings.section.appearance}</h3>
      <div className="field" style={{ marginTop: 8 }}>
        <label>{t.settings.theme}</label>
        <select value={store.theme} onChange={(e) => store.setTheme(e.target.value as "dark" | "light" | "system")}>
          <option value="dark">{t.settings.themes.dark}</option>
          <option value="light">{t.settings.themes.light}</option>
          <option value="system">{t.settings.themes.system}</option>
        </select>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>{t.settings.language}</label>
        <select value={lang} onChange={(e) => setLang(e.target.value as "de" | "en")}>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>{t.settings.numberFormat}</label>
        <select defaultValue="de">
          <option value="de">1.234.567,89</option>
          <option value="en">1,234,567.89</option>
        </select>
      </div>

      <h3 style={{ marginTop: 24 }}>{t.settings.section.data}</h3>
      <div className="field" style={{ marginTop: 8 }}>
        <label>{t.settings.storage}</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input readOnly value={store.storagePath ?? t.settings.storagePath} />
          <button className="btn" onClick={onChangeStorageDir} disabled={changingDir}>
            {changingDir ? "Ändere…" : "Ändern…"}
          </button>
        </div>
        <p className="settings-hint">
          Die Benutzerdaten liegen als "user-data.json" in diesem Verzeichnis (inkl. .bak-Sicherung).
          Beim Ändern werden vorhandene Daten übernommen, falls im neuen Verzeichnis noch keine liegen.
        </p>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>{t.settings.backups}</label>
        <input type="checkbox" defaultChecked />
      </div>

      <h3 style={{ marginTop: 24 }}>{t.settings.section.update}</h3>
      <div className="field" style={{ marginTop: 8 }}>
        <label>{t.settings.updateCheck}</label>
        <input type="checkbox" defaultChecked />
      </div>

      <h3 style={{ marginTop: 24 }}>{t.settings.section.about}</h3>
      <div className="hint" style={{ marginTop: 8 }}>
        D2 Build Optimizer 0.1.0 · MVP 1.1 (Datenhaltung & Inventar)
      </div>
    </div>
  );
}
