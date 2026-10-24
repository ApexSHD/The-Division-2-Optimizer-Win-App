import { useStore } from "../store";
import { I18nContext } from "../i18n";
import { useContext } from "react";

export function GlobalView() {
  const store = useStore();
  const { t } = useContext(I18nContext);

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="field">
        <label>{t.global.chc} (%)</label>
        <input
          type="number"
          min={0}
          max={60}
          value={store.agent.chc}
          onChange={(e) => store.setAgent({ ...store.agent, chc: Number(e.target.value) })}
        />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>{t.global.chd} (%)</label>
        <input
          type="number"
          min={0}
          max={200}
          value={store.agent.chd}
          onChange={(e) => store.setAgent({ ...store.agent, chd: Number(e.target.value) })}
        />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>{t.global.wd} (%)</label>
        <input
          type="number"
          min={0}
          max={100}
          value={store.agent.wd}
          onChange={(e) => store.setAgent({ ...store.agent, wd: Number(e.target.value) })}
        />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>{t.global.spec}</label>
        <select defaultValue="sharpshooter">
          <option value="demolitionist">Granatwerfer</option>
          <option value="gunner">MG-Schütze</option>
          <option value="sharpshooter">Scharfschütze</option>
          <option value="survivalist">Überlebenskünstler</option>
          <option value="technician">Techniker</option>
        </select>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>{t.global.mode}</label>
        <select defaultValue="pve">
          <option value="pve">PvE</option>
          <option value="pvp">PvP</option>
        </select>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>{t.global.season}</label>
        <select defaultValue="y8s3">
          <option value="y8s2">Y8S2</option>
          <option value="y8s3">Y8S3</option>
        </select>
      </div>
    </div>
  );
}
