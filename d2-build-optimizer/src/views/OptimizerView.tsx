import { useContext, useEffect, useState } from "react";
import { useStore, DEFAULT_OPTIMIZATION } from "../store";
import { I18nContext } from "../i18n";
import { OptimizationSettingsPanel } from "../components/OptimizationSettingsPanel";
import { optimizeBuilds } from "../data/damage";
import type { OptimizerResult, SlotExplanation } from "../data/damage";
import { GEAR_CORE_LABELS } from "../data/sampleData";
import type { GearCoreType } from "../data/sampleData";

function SlotExplanationBox({ exp }: { exp: SlotExplanation }) {
  const g = exp.chosen;
  return (
    <div className="slot-explanation">
      <div><strong>{g.brand}</strong> · {GEAR_CORE_LABELS[g.core as GearCoreType]}{g.talent ? ` · Talent ${g.talent}` : ""} · <span className="accent">Score {exp.score} %</span></div>
      <div style={{ color: "var(--text-dim, #aaa)", fontSize: 12 }}>
        Warum gewählt? {exp.reason}.
      </div>
      {exp.runnerUp && (
        <div style={{ color: "var(--text-dim, #aaa)", fontSize: 12 }}>
          Zweitbeste Alternative: {exp.runnerUp.item.brand} ({exp.runnerUp.reason}) — ergäbe {exp.runnerUp.dpsDelta.toLocaleString("de-DE", { maximumFractionDigits: 0 })} weniger DPS.
        </div>
      )}
      {exp.calibrationHint && (
        <div className="slot-calibration">
          🔧 Kalibrierung: {exp.calibrationHint.attributeLabel} liegt bei {exp.calibrationHint.currentPercent} % ({exp.calibrationHint.currentValue.toLocaleString("de-DE")} / {exp.calibrationHint.maxValue.toLocaleString("de-DE")}) — ziehe das Attribut auf Max, um das volle Potenzial zu entfalten.
        </div>
      )}
    </div>
  );
}
import { getDb } from "../data/db";
import type { GearSetItemPreset } from "../data/db";

export function OptimizerView() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const [results, setResults] = useState<OptimizerResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [gearSets, setGearSets] = useState<GearSetItemPreset[]>([]);
  const o = store.optimization;

  useEffect(() => {
    getDb().then((db) => setGearSets(db.gearSetItems)).catch(() => setGearSets([]));
  }, []);

  function startOptimization() {
    setRunning(true);
    store.setStatus(t.status.calculating);
    store.setProgress(10);
    setTimeout(() => {
      try {
        const res = optimizeBuilds(
          store.weapons,
          store.gear,
          store.agent.shdLevel,
          o,
          {
            gearSetNames: gearSets.map((gs) => gs.name),
            maxResults: 10,
          },
        );
        setResults(res);
        store.setStatus(
          res.length > 0
            ? `${res.length} beste Build(s) berechnet`
            : "Keine passende Kombination gefunden — Inventar oder Bedingungen prüfen",
        );
      } catch (e) {
        setResults([]);
        store.setStatus(`Optimierung fehlgeschlagen: ${e}`);
      } finally {
        store.setProgress(null);
        setRunning(false);
      }
    }, 50);
  }

  const set = (patch: Partial<typeof o>) => store.setOptimization({ ...o, ...patch });

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="field">
        <label>{t.optimizer.goal}</label>
        <select defaultValue="weaponDamage">
          <option value="weaponDamage">{t.optimizer.goals.weaponDamage}</option>
          <option value="critBalance">{t.optimizer.goals.critBalance}</option>
          <option value="armor">{t.optimizer.goals.armor}</option>
        </select>
      </div>

      <h3 style={{ margin: "18px 0 8px" }}>Einstellungen für Optimierung</h3>
      <OptimizationSettingsPanel optimization={o} onChange={store.setOptimization} />

      <section className="settings-section">
        <h4 className="settings-section-title">Zusätzliche Ziele &amp; Bedingungen</h4>
        <div className="field" style={{ marginTop: 6 }}>
          <label>Gear-Set als optionales Zusatzziel (mindestens 2 Teile)</label>
          <select value={o.targetGearSet} onChange={(e) => set({ targetGearSet: e.target.value })}>
            <option value="">– kein bestimmtes Set –</option>
            {gearSets.map((gs) => (
              <option key={gs.key} value={gs.name}>{gs.name}</option>
            ))}
          </select>
          <p className="settings-hint">
            Wenn gewählt, zeigt der Optimizer bevorzugt Builds mit diesem Gear-Set.
          </p>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={o.requiredChest}
            onChange={(e) => set({ requiredChest: e.target.checked })}
          />
          <span className="check-text">Weste zwingend erforderlich</span>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={o.requiredBackpack}
            onChange={(e) => set({ requiredBackpack: e.target.checked })}
          />
          <span className="check-text">Rucksack zwingend erforderlich</span>
        </label>
        <label className="check-row">
          <input type="checkbox" defaultChecked />
          <span className="check-text">{t.optimizer.exoticLimit}</span>
        </label>
      </section>

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button className="btn btn-accent" onClick={startOptimization} disabled={running}>
          {running ? "Berechne…" : t.optimizer.start}
        </button>
        <button
          className="btn"
          onClick={() => {
            store.setOptimization({ ...DEFAULT_OPTIMIZATION });
            setResults(null);
            store.setStatus("Einstellungen zurückgesetzt");
          }}
        >
          Zurücksetzen
        </button>
      </div>

      {store.progress !== null && (
        <div style={{ marginTop: 12 }}>
          <div className="progress">
            <div className="progress-bar" style={{ width: `${store.progress}%` }} />
          </div>
        </div>
      )}

      <h3 style={{ margin: "22px 0 8px" }}>{t.optimizer.results}</h3>
      {results === null && <div className="hint">{t.optimizer.resultsPlaceholder}</div>}
      {results !== null && results.length === 0 && (
        <div className="hint">
          Keine passende Kombination gefunden. Inventar erfassen oder Bedingungen lockern
          (z. B. Gear-Set-Ziel oder Pflicht-Weste/Rucksack deaktivieren).
        </div>
      )}
      {results !== null && results.length > 0 && results.some((r) => r.warnings.length > 0) && (
        <div className="optimizer-warnings">
          {Array.from(new Set(results.flatMap((r) => r.warnings.map((wn) => wn.message))))
            .filter((msg, idx, arr) => arr.indexOf(msg) === idx)
            .slice(0, 3)
            .map((msg) => (
              <div key={msg} className="warn-banner warn-yellow">⚠ {msg}</div>
            ))}
        </div>
      )}
      {results !== null && results.length > 0 && (
        <div className="table-wrap" style={{ maxHeight: 420 }}>
          <table>
            <thead>
              <tr>
                <th>Rang</th>
                <th>Waffe</th>
                <th>Gear (Slots)</th>
                <th>WD</th>
                <th>CHC</th>
                <th>CHD</th>
                <th>Ø Schaden/Treffer</th>
                <th>DPS</th>
                <th>Begründung</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.rank}>
                  <td><strong>{r.rank}</strong></td>
                  <td>
                    {r.weapon.name}
                    {r.weapon.isPrototype && <span className="badge gearset" style={{ marginLeft: 4 }}>P</span>}
                  </td>
                  <td style={{ fontSize: 11 }}>
                    {r.gear.map((g) => g.brand).join(" · ")}
                    <div style={{ color: "var(--text-dim, #aaa)" }}>
                      {r.gear.length} Teil(e)
                    </div>
                  </td>
                  <td>+{r.stats.wd.toLocaleString("de-DE")} %</td>
                  <td>{r.damage.cappedChc} %</td>
                  <td>+{r.stats.chd.toLocaleString("de-DE")} %</td>
                  <td>{r.damage.avgBulletDmg.toLocaleString("de-DE", { maximumFractionDigits: 0 })}</td>
                  <td><strong>{r.damage.effectiveDps.toLocaleString("de-DE", { maximumFractionDigits: 0 })}</strong></td>
                  <td style={{ fontSize: 11 }}>
                    {r.reason}
                    <details style={{ marginTop: 4 }}>
                      <summary style={{ cursor: "pointer", color: "var(--accent, #4da3ff)" }}>Warum diese Teile?</summary>
                      {r.slotExplanations.map((exp) => (
                        <SlotExplanationBox key={exp.chosen.id} exp={exp} />
                      ))}
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
