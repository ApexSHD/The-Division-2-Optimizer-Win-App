import { useContext } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";

export function SettingsView() {
  const store = useStore();
  const { t, lang, setLang } = useContext(I18nContext);

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
        <input readOnly value={t.settings.storagePath} />
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
        D2 Build Optimizer 0.1.0 · MVP 1.0 (GUI-Prototyp) · {t.common.placeholder}
      </div>
    </div>
  );
}
