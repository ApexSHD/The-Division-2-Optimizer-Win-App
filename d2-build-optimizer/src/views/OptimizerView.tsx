import { useContext } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";

export function OptimizerView() {
  const store = useStore();
  const { t } = useContext(I18nContext);

  function startOptimization() {
    store.setStatus(t.status.calculating);
    store.setProgress(0);
    let p = 0;
    const timer = setInterval(() => {
      p += 4;
      store.setProgress(Math.min(p, 100));
      if (p >= 100) {
        clearInterval(timer);
        store.setStatus(t.status.ready);
        store.setProgress(null);
      }
    }, 80);
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="field">
        <label>{t.optimizer.goal}</label>
        <select defaultValue="weaponDamage">
          <option value="weaponDamage">{t.optimizer.goals.weaponDamage}</option>
          <option value="critBalance">{t.optimizer.goals.critBalance}</option>
          <option value="armor">{t.optimizer.goals.armor}</option>
        </select>
      </div>

      <h3 style={{ margin: "18px 0 8px" }}>{t.optimizer.constraints}</h3>
      <div className="field">
        <label>{t.optimizer.exoticLimit}</label>
        <input type="checkbox" defaultChecked />
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>{t.optimizer.chcCap}</label>
        <input type="number" min={0} max={60} defaultValue={60} style={{ width: 120 }} />
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>{t.optimizer.mustInclude}</label>
        <select multiple size={3} style={{ width: "100%" }}>
          <option>Eagle Bearer</option>
          <option>Coyote's Mask</option>
          <option>St Elmo's Engine</option>
        </select>
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>{t.optimizer.exclude}</label>
        <select multiple size={3} style={{ width: "100%" }}>
          <option>Chatterbox</option>
          <option>Lady Death</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button className="btn btn-accent" onClick={startOptimization}>{t.optimizer.start}</button>
        <button className="btn" onClick={() => store.setProgress(null)}>{t.optimizer.stop}</button>
      </div>

      {store.progress !== null && (
        <div style={{ marginTop: 12 }}>
          <div className="progress">
            <div className="progress-bar" style={{ width: `${store.progress}%` }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>
            {t.optimizer.progress} {store.progress} %
          </div>
        </div>
      )}

      <h3 style={{ margin: "22px 0 8px" }}>{t.optimizer.results}</h3>
      <div className="hint">{t.optimizer.resultsPlaceholder}</div>
    </div>
  );
}
