import { useStore, shdBonusFor, SHD_WATCH_ATTRIBUTES } from "../store";
import { I18nContext } from "../i18n";
import { useContext, useState } from "react";

function WatchBonusTable({ shdLevel }: { shdLevel: number }) {
  const categories: { key: keyof typeof SHD_WATCH_ATTRIBUTES; label: string }[] = [
    { key: "offensive", label: "Angriff (Offensive)" },
    { key: "defensive", label: "Verteidigung (Defensive)" },
    { key: "handling", label: "Handhabung (Weapon Handling)" },
    { key: "utility", label: "Nutzen (Utility)" },
  ];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {categories.map((cat) => (
        <div key={cat.key} className="field" style={{ margin: 0 }}>
          <label style={{ fontWeight: 700 }}>{cat.label}</label>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <tbody>
              {SHD_WATCH_ATTRIBUTES[cat.key].map((attr) => (
                <tr key={attr.key}>
                  <td style={{ padding: "2px 8px 2px 0" }}>{attr.label}</td>
                  <td style={{ padding: "2px 0", textAlign: "right", whiteSpace: "nowrap", color: "var(--text-dim, #aaa)" }}>
                    +{shdBonusFor(shdLevel, attr.key).toLocaleString("de-DE")} %
                  </td>
                  <td style={{ padding: "2px 0 2px 10px", textAlign: "right", whiteSpace: "nowrap", color: "var(--text-dim, #aaa)", width: 1 }}>
                    (+{attr.perLevel.toLocaleString("de-DE")} % pro Stufe)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function GlobalView() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const a = store.agent;
  const [showWatch, setShowWatch] = useState(false);

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="field">
        <label>SHD-Level (Standard 1.000) — Bonus der SHD-Uhr</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="number"
            min={0}
            max={10000}
            value={a.shdLevel}
            onChange={(e) =>
              store.setAgent({ ...a, shdLevel: Math.max(0, Math.min(10000, Number(e.target.value))) })
            }
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 12, color: "var(--text-dim, #aaa)" }}>
            Watch-Boni steigen bis Stufe 50 pro Attribut, danach bei weiterem Level keine Zusatzboni
          </span>
        </div>
      </div>
      <div style={{ margin: "10px 0 0" }}>
        <button
          type="button"
          className="btn"
          title="Aktuelle Watch-Boni aus dem SHD-Level anzeigen"
          onClick={() => setShowWatch((v) => !v)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 10px" }}
        >
          ℹ Watch-Boni anzeigen
        </button>
        {showWatch && (
          <div style={{ marginTop: 10 }}>
            <div style={{ margin: "0 0 6px", fontSize: 12, color: "var(--text-dim, #aaa)" }}>
              Aktuelle Watch-Boni aus dem SHD-Level (fließen später in die Kalkulation ein):
            </div>
            <WatchBonusTable shdLevel={a.shdLevel} />
          </div>
        )}
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label>{t.global.spec}</label>
        <select
          value={a.spec}
          onChange={(e) => store.setAgent({ ...a, spec: e.target.value })}
        >
          <option value="demolitionist">Granatwerfer</option>
          <option value="gunner">MG-Schütze</option>
          <option value="sharpshooter">Scharfschütze</option>
          <option value="survivalist">Überlebenskünstler</option>
          <option value="technician">Techniker</option>
          <option value="firewall">Firewall</option>
        </select>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>{t.global.mode}</label>
        <select
          value={a.mode}
          onChange={(e) => store.setAgent({ ...a, mode: e.target.value as "pve" | "pvp" })}
        >
          <option value="pve">PvE</option>
          <option value="pvp">PvP (wird später integriert)</option>
        </select>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>{t.global.season}</label>
        <select
          value={a.season}
          onChange={(e) => store.setAgent({ ...a, season: e.target.value })}
        >
          <option value="y8s2">Y8S2</option>
          <option value="y8s3">Y8S3</option>
        </select>
      </div>


      <p className="settings-hint" style={{ marginTop: 16 }}>
        Gegnerprofil, CHC-/HSD-Zielwerte und Zielmetrik werden im <strong>Optimierer</strong>
        (Abschnitt „Rahmen“) konfiguriert — inklusive Gegnertyp-Presets (Standard, Elite, Named,
        Lebensenergie, Kopfschuss-Fokus, Eigen).
      </p>
    </div>
  );
}
