import { useContext, useEffect, useState } from "react";
import { useStore, DEFAULT_OPTIMIZATION } from "../store";
import { I18nContext, type Language } from "../i18n";
import { OptimizationSettingsPanel } from "../components/OptimizationSettingsPanel";
import { optimizeBuilds, aggregateBuild, computeDamage, enemyProfileFromSettings } from "../data/damage";
import type { OptimizerResult } from "../data/damage";
import { getDb } from "../data/db";
import type { GearSetItemPreset } from "../data/db";
import { ROLE_PRESETS, rolePreset, type RoleId } from "../data/roles";

type Step = 0 | 1 | 2 | 3;

function QuickSwapPanel({
  base,
  gear,
  shdLevel,
  settings,
  adjusted,
  onAdjusted,
}: {
  base: OptimizerResult;
  gear: import("../data/sampleData").GearPiece[];
  shdLevel: number;
  settings: import("../store").OptimizationSettings;
  adjusted: string[] | null;
  onAdjusted: (ids: string[] | null) => void;
}) {
  const current = adjusted ?? base.gear.map((g) => g.id);
  const items = current
    .map((id) => gear.find((g) => g.id === id))
    .filter((g): g is import("../data/sampleData").GearPiece => Boolean(g));

  const stats = aggregateBuild(items, shdLevel);
  const profile = enemyProfileFromSettings(settings);
  const damage = computeDamage(base.weapon, stats, profile);

  const cores = { wd: 0, armour: 0, skill: 0 };
  for (const g of items) cores[g.core] += 1;

  const swap = (slot: string, newId: string) => {
    const slotItem = items.find((g) => g.slot === slot);
    if (!slotItem) return;
    onAdjusted(current.map((id) => (id === slotItem.id ? newId : id)));
  };

  const fmt = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 0 });

  return (
    <div>
      <h3 style={{ margin: "0 0 4px" }}>Feintuning: {base.weapon.name}</h3>
      <p className="settings-hint" style={{ marginTop: 0 }}>
        Anderes Teil wählen — Gesamtwerte werden in Echtzeit neu berechnet.
      </p>

      <div className="core-bar">
        <span className="core-chip core-red">{cores.wd} × Rot</span>
        <span className="core-chip core-blue">{cores.armour} × Blau</span>
        <span className="core-chip core-yellow">{cores.skill} × Gelb</span>
      </div>

      <div className="quickswap-grid">
        {items.map((g) => {
          const alternatives = gear
            .filter((c) => c.slot === g.slot && c.id !== g.id)
            .map((c) => {
              const altStats = aggregateBuild(
                items.map((x) => (x.slot === g.slot ? c : x)),
                shdLevel,
              );
              const altDmg = computeDamage(base.weapon, altStats, profile);
              return { item: c, dps: altDmg.effectiveDps };
            })
            .sort((a, b) => b.dps - a.dps);
          return (
            <div key={g.id} className="quickswap-slot">
              <label>{g.slot}</label>
              <select value={g.id} onChange={(e) => swap(g.slot, e.target.value)}>
                <option value={g.id}>{g.brand} — aktuell</option>
                {alternatives.map((alt) => (
                  <option key={alt.item.id} value={alt.item.id}>
                    {alt.item.brand} ({fmt(alt.dps)} DPS)
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div className="quickswap-stats">
        <span>CHC: <strong>{damage.cappedChc} %</strong></span>
        <span>WD: <strong>+{fmt(stats.wd)} %</strong></span>
        <span>CHD: <strong>+{fmt(stats.chd)} %</strong></span>
        <span>Ø Schaden: <strong>{fmt(damage.avgBulletDmg)}</strong></span>
        <span>DPS: <strong>{fmt(damage.effectiveDps)}</strong></span>
        {adjusted && (
          <button className="btn" style={{ marginLeft: "auto" }} onClick={() => onAdjusted(null)}>
            Zurücksetzen
          </button>
        )}
      </div>
    </div>
  );
}

export function WizardView() {
  const store = useStore();
  const { t, lang } = useContext(I18nContext) as { t: typeof import("../i18n/de").de; lang: Language };
  const [step, setStep] = useState<Step>(0);
  const [role, setRole] = useState<RoleId | "">("");
  const [anchorWeaponId, setAnchorWeaponId] = useState<string>("init-from-settings");
  const [results, setResults] = useState<OptimizerResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [gearSets, setGearSets] = useState<GearSetItemPreset[]>([]);
  const [adjusted, setAdjusted] = useState<string[] | null>(null);
  const o = store.optimization;

  useEffect(() => {
    setAnchorWeaponId(store.optimization.anchorWeaponId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        setAdjusted(null);
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
  const anchorCandidates = store.weapons;

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
            <select
              value={anchorWeaponId}
              onChange={(e) => {
                setAnchorWeaponId(e.target.value);
                store.setOptimization({ ...o, anchorWeaponId: e.target.value });
              }}
            >
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
            <h4 className="settings-section-title">Einschränkungen &amp; Inventar-Regeln</h4>
            <label className="check-row" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={o.qualityFilter === "godRoll"}
                onChange={(e) => store.setOptimization({ ...o, qualityFilter: e.target.checked ? "godRoll" : "all" })}
              />
              <span className="check-text">
                <span style={{ fontWeight: 600 }}>Nur God-Rolls / Max-Stats einbeziehen</span>
                <p className="settings-hint">
                  Aus: alle Inventar-Items nutzen (auch mit Kalibrierungs-Potenzial). Gesperrte Teile bleiben immer dabei.
                </p>
              </span>
            </label>
            <div className="field" style={{ marginTop: 10 }}>
              <label>Marken-Präferenz (optional)</label>
              <input
                type="text"
                placeholder="z. B. Česká / Grupo"
                value={o.preferredBrand}
                onChange={(e) => store.setOptimization({ ...o, preferredBrand: e.target.value })}
              />
              <p className="settings-hint">
                Builds mit dieser Marke werden im Ranking bevorzugt (kein harter Ausschluss — verhindert Dead Ends).
              </p>
            </div>
            {store.gear.length > 0 && (
              <div className="field" style={{ marginTop: 10 }}>
                <label>Gesperrte Items (Locks) — diese Teile werden nie ausgetauscht ({o.lockedGearIds.filter((id) => store.gear.some((g) => g.id === id)).length} gesperrt)</label>
                <div className="lock-list">
                  {(["mask", "chest", "holster", "backpack", "gloves", "kneepads"] as const).map((slot) => {
                    const slotItems = store.gear.filter((g) => g.slot === slot);
                    if (slotItems.length === 0) return null;
                    const lockedCount = slotItems.filter((g) => o.lockedGearIds.includes(g.id)).length;
                    const slotLabel: Record<string, string> = {
                      mask: "Maske", chest: "Weste", holster: "Holster",
                      backpack: "Rucksack", gloves: "Handschuhe", kneepads: "Knieschoner",
                    };
                    return (
                      <details key={slot} className="lock-slot" open={lockedCount > 0}>
                        <summary>
                          {slotLabel[slot]} <span className="lock-count">{lockedCount}/{slotItems.length} gesperrt</span>
                        </summary>
                        <div className="lock-slot-items">
                          {slotItems.map((g) => (
                            <label key={g.id} className="check-row lock-row">
                              <input
                                type="checkbox"
                                checked={o.lockedGearIds.includes(g.id)}
                                onChange={(e) =>
                                  store.setOptimization({
                                    ...o,
                                    lockedGearIds: e.target.checked
                                      ? [...o.lockedGearIds, g.id]
                                      : o.lockedGearIds.filter((id) => id !== g.id),
                                  })
                                }
                              />
                              <span className="check-text">
                                <span>{g.brand}{g.talent ? ` · ${g.talent}` : ""}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
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
          {results === null || results.length === 0 ? (
            <div className="hint">Erst berechnen (Schritt 3), dann hier feintunen.</div>
          ) : (
            <QuickSwapPanel
              base={results[0]}
              gear={store.gear}
              shdLevel={store.agent.shdLevel}
              settings={o}
              adjusted={adjusted}
              onAdjusted={setAdjusted}
            />
          )}
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
              store.setOptimization({ ...o, anchorWeaponId: "" });
            }}
          >
            {t.wizard.startOver}
          </button>
        )}
      </div>
    </div>
  );
}
