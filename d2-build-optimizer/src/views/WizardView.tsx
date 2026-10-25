import { useContext, useEffect, useState } from "react";
import { useStore, DEFAULT_OPTIMIZATION } from "../store";
import { I18nContext, type Language } from "../i18n";
import { OptimizationSettingsPanel } from "../components/OptimizationSettingsPanel";
import { optimizeBuilds } from "../data/damage";
import type { OptimizerResult } from "../data/damage";
import { getDb } from "../data/db";
import type { GearSetItemPreset } from "../data/db";
import { ROLE_PRESETS, rolePreset, type RoleId } from "../data/roles";

type Step = 0 | 1 | 2 | 3;

export function WizardView() {
  const store = useStore();
  const { t, lang } = useContext(I18nContext) as { t: typeof import("../i18n/de").de; lang: Language };
  const [step, setStep] = useState<Step>(0);
  const [role, setRole] = useState<RoleId | "">("");
  const [anchorWeaponId, setAnchorWeaponId] = useState("");
  const [results, setResults] = useState<OptimizerResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [gearSets, setGearSets] = useState<GearSetItemPreset[]>([]);
  const o = store.optimization;

  useEffect(() => {
    getDb().then((db) => setGearSets(db.gearSetItems)).catch(() => setGearSets([]));
  }, []);

  useEffect(() => {
    if (o.role) setRole(o.role);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function chooseRole(id: RoleId) {
    const preset = rolePreset(id);
    setRole(id);
    store.setOptimization({ ...DEFAULT_OPTIMIZATION, ...preset.patch, role: id });
    store.setStatus(`${lang === "de" ? "Rolle gewählt" : "Role selected"}: ${lang === "de" ? preset.labelDe : preset.labelEn}`);
  }

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

  function goNext() {
    if (step === 0) {
      if (!role) {
        store.setStatus(lang === "de" ? "Bitte zuerst eine Rolle wählen" : "Please pick a role first");
        return;
      }
      setStep(1);
    } else if (step === 1) {
      setStep(2);
      startOptimization();
    } else if (step === 2) {
      setStep(3);
    }
  }

  const stepLabels = [t.wizard.steps.role, t.wizard.steps.rules, t.wizard.steps.result, t.wizard.steps.tuning];
  const anchorCandidates = store.weapons.filter((w) => !w.isPrototype || w.rarity === "exotic");

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="wizard-steps" role="tablist" aria-label={t.wizard.subtitle}>
        {stepLabels.map((label, i) => (
          <div key={label} className={`wizard-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}>
            <span className="wizard-step-num">{i < step ? "✓" : i + 1}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <section style={{ marginTop: 18 }}>
          <h3 style={{ margin: "0 0 4px" }}>{t.wizard.roleQuestion}</h3>
          <p className="settings-hint" style={{ marginTop: 0 }}>{t.wizard.roleHint}</p>
          <div className="role-tiles">
            {ROLE_PRESETS.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`role-tile ${role === r.id ? "active" : ""}`}
                onClick={() => chooseRole(r.id)}
              >
                <span className="role-tile-icon" aria-hidden>{r.icon}</span>
                <span className="role-tile-label">{lang === "de" ? r.labelDe : r.labelEn}</span>
                <span className="role-tile-desc">{lang === "de" ? r.descDe : r.descEn}</span>
              </button>
            ))}
          </div>

          <div className="field" style={{ marginTop: 18 }}>
            <label>{t.wizard.anchor.label}</label>
            <select value={anchorWeaponId} onChange={(e) => setAnchorWeaponId(e.target.value)}>
              <option value="">{t.wizard.anchor.none}</option>
              {anchorCandidates.map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
              ))}
            </select>
            <p className="settings-hint">{t.wizard.anchor.hint}</p>
          </div>
        </section>
      )}

      {step === 1 && (
        <section style={{ marginTop: 18 }}>
          <h3 style={{ margin: "0 0 4px" }}>{t.wizard.rulesQuestion}</h3>
          <OptimizationSettingsPanel optimization={o} onChange={store.setOptimization} />
          <section className="settings-section">
            <h4 className="settings-section-title">Gear-Set als optionales Zusatzziel</h4>
            <div className="field" style={{ marginTop: 6 }}>
              <select value={o.targetGearSet} onChange={(e) => store.setOptimization({ ...o, targetGearSet: e.target.value })}>
                <option value="">– kein bestimmtes Set –</option>
                {gearSets.map((gs) => (
                  <option key={gs.key} value={gs.name}>{gs.name}</option>
                ))}
              </select>
            </div>
          </section>
        </section>
      )}

      {step === 2 && (
        <section style={{ marginTop: 18 }}>
          {results === null && <div className="hint">{t.wizard.resultPlaceholder}</div>}
          {results !== null && results.length === 0 && (
            <div className="hint">
              Keine passende Kombination gefunden — Inventar erfassen oder Bedingungen lockern.
            </div>
          )}
          {results !== null && results.length > 0 && results.some((r) => r.warnings.length > 0) && (
            <div className="optimizer-warnings" style={{ marginBottom: 10 }}>
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
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.rank}>
                      <td><strong>{r.rank}</strong></td>
                      <td>{r.weapon.name}</td>
                      <td style={{ fontSize: 11 }}>{r.gear.map((g) => g.brand).join(" · ")}</td>
                      <td>+{r.stats.wd.toLocaleString("de-DE")} %</td>
                      <td>{r.damage.cappedChc} %</td>
                      <td>+{r.stats.chd.toLocaleString("de-DE")} %</td>
                      <td>{r.damage.avgBulletDmg.toLocaleString("de-DE", { maximumFractionDigits: 0 })}</td>
                      <td><strong>{r.damage.effectiveDps.toLocaleString("de-DE", { maximumFractionDigits: 0 })}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {step === 3 && (
        <section style={{ marginTop: 18 }}>
          <div className="hint">{t.wizard.phasePlanned} — Issue #41 (Quick-Swap).</div>
        </section>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
        {step > 0 && (
          <button className="btn" onClick={() => setStep((s) => (s - 1) as Step)}>
            ← {t.wizard.back}
          </button>
        )}
        {step < 3 && (
          <button className="btn btn-accent" onClick={goNext} disabled={step === 1 && running}>
            {step === 1 ? (running ? "Berechne…" : t.wizard.calculate) : `${t.wizard.next} →`}
          </button>
        )}
        {step === 3 && (
          <button
            className="btn"
            onClick={() => {
              setStep(0);
              setResults(null);
              setAnchorWeaponId("");
            }}
          >
            {t.wizard.startOver}
          </button>
        )}
      </div>
    </div>
  );
}
