import { useContext, useState } from "react";
import { useStore, DEFAULT_OPTIMIZATION } from "../store";
import { I18nContext } from "../i18n";
import { OptimizationSettingsPanel } from "../components/OptimizationSettingsPanel";
import { OptimizerResultsTable, OptimizerWarnings } from "../components/OptimizerResults";
import { optimizerRunOptions, useOptimizerCatalog } from "../data/optimizerCatalog";
import { runOptimizerAsync } from "../data/optimizerClient";
import type { OptimizerResult, SlotExplanation, StatSource } from "../data/damage";
import { GEAR_CORE_LABELS } from "../data/sampleData";
import type { GearCoreType } from "../data/sampleData";

function SourceList({ sources }: { sources: StatSource[] }) {
  if (!sources || sources.length === 0) return <div style={{ color: "var(--text-faint, #777)" }}>keine Quelle</div>;
  return (
    <ul className="source-list">
      {sources.map((src, i) => (
        <li key={`${src.itemId}-${i}`}>
          <span>{src.label}</span>
          <span className="source-val">+{src.value.toLocaleString("de-DE")} %</span>
        </li>
      ))}
    </ul>
  );
}

function CalcPathBox({ r }: { r: OptimizerResult }) {
  const d = r.damage;
  const st = r.stats;
  const fmt = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 0 });
  const rows: { label: string; value: string; sourcesKey?: string }[] = [
    { label: "Waffenschaden (WD) gesamt", value: `+${fmt(st.wd)} %`, sourcesKey: "wd" },
    { label: "Kritische Trefferchance (CHC) — gedeckelt bei 60 %", value: `${d.cappedChc} %`, sourcesKey: "chc" },
    { label: "Kritischer Trefferschaden (CHD)", value: `+${fmt(st.chd)} %`, sourcesKey: "chd" },
    { label: "Kopfschussschaden (HSD)", value: `+${fmt(st.hsd)} %`, sourcesKey: "hsd" },
    { label: "Rüstungsschaden (DTA)", value: `+${fmt(st.dta)} %`, sourcesKey: "dta" },
    { label: "Lebenspunktschaden (DTH)", value: `+${fmt(st.dth)} %`, sourcesKey: "dth" },
    { label: "Schaden gg. ungedeckte Ziele (DTTOOC)", value: `+${fmt(st.dttooc)} %`, sourcesKey: "dttooc" },
    { label: "Ø Schaden pro Treffer", value: fmt(d.avgBulletDmg) },
    { label: "Effektiver DPS (RPM eingerechnet)", value: fmt(d.effectiveDps) },
  ];
  return (
    <div className="calc-path">
      <div className="calc-formula">
        Basis × WD × TWD × DTA/DTH/DTTOOC × Situativ × Amp × Crit/HSD
      </div>
      <table className="calc-table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td className="calc-val">{row.value}</td>
              <td className="calc-sources">
                {row.sourcesKey && (
                  <details>
                    <summary>Quellen</summary>
                    <SourceList sources={st.sources?.[row.sourcesKey] ?? []} />
                  </details>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

export function OptimizerView() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const [results, setResults] = useState<OptimizerResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const catalog = useOptimizerCatalog();
  const o = store.optimization;

  function startOptimization() {
    setRunning(true);
    store.setStatus(t.status.calculating);
    store.setProgress(15);
    const run = runOptimizerAsync(
      store.weapons,
      store.gear,
      store.agent.shdLevel,
      o,
      optimizerRunOptions(catalog, store.agent.spec),
      { onProgress: (pct) => store.setProgress(pct) },
    );
    run.promise
      .then((res) => {
        setResults(res);
        store.setStatus(
          res.length > 0
            ? `${res.length} beste Build(s) berechnet`
            : "Keine passende Kombination gefunden — Inventar oder Bedingungen prüfen",
        );
      })
      .catch((e) => {
        setResults([]);
        store.setStatus(`Optimierung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
      })
      .finally(() => {
        store.setProgress(null);
        setRunning(false);
      });
  }

  const set = (patch: Partial<typeof o>) => store.setOptimization({ ...o, ...patch });

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="field">
        <label>{t.optimizer.goal}</label>
        <select value={o.role || "weaponDps"} disabled>
          <option value="weaponDps">{t.optimizer.goals.weaponDamage}</option>
        </select>
        <p className="settings-hint">
          Das Ziel wird im Assistenten über die Rollenwahl gesetzt (optimiert aktuell: Waffen-DPS).
        </p>
      </div>

      <h3 style={{ margin: "18px 0 8px" }}>Einstellungen für Optimierung</h3>
      <OptimizationSettingsPanel optimization={o} onChange={store.setOptimization} />

      <section className="settings-section">
        <h4 className="settings-section-title">Zusätzliche Ziele &amp; Bedingungen</h4>
        <div className="field" style={{ marginTop: 6 }}>
          <label>Gear-Set als optionales Zusatzziel (mindestens 2 Teile)</label>
          <select value={o.targetGearSet} onChange={(e) => set({ targetGearSet: e.target.value })}>
            <option value="">– kein bestimmtes Set –</option>
            {catalog.gearSets.map((gs) => (
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
        <div className="hint" style={{ marginTop: 8 }}>
          {t.optimizer.exoticLimit} — aktiv (max. 1 Exotic-Gear pro Build, fest erzwungen)
        </div>
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
      {results !== null && results.length > 0 && (
        <>
          <OptimizerWarnings results={results} />
          <OptimizerResultsTable results={results} showReasons />
          {results.map((r) => (
            <details key={r.rank} style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", color: "var(--accent, #4da3ff)" }}>
                Details zu Build #{r.rank}: {r.weapon.name}
              </summary>
              <div className="calc-path">
                {r.assumptions.wastedChc > 0 && (
                  <div className="warn-banner warn-yellow" style={{ marginBottom: 6 }}>
                    ⚠ {r.assumptions.wastedChc} Prozentpunkte CHC über dem Cap (60 %) — verschwendeter Stat
                  </div>
                )}
                <ul className="source-list">
                  {r.assumptions.items.map((a) => (
                    <li key={a.label}>
                      <span>{a.label}</span>
                      <span style={{ color: "var(--text-dim, #aaa)" }}>{a.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <details style={{ marginTop: 4 }}>
                <summary style={{ cursor: "pointer", color: "var(--accent, #4da3ff)" }}>Rechenweg</summary>
                <CalcPathBox r={r} />
              </details>
              <details style={{ marginTop: 4 }}>
                <summary style={{ cursor: "pointer", color: "var(--accent, #4da3ff)" }}>Warum diese Teile?</summary>
                {r.slotExplanations.map((exp) => (
                  <SlotExplanationBox key={exp.chosen.id} exp={exp} />
                ))}
              </details>
            </details>
          ))}
        </>
      )}
    </div>
  );
}
