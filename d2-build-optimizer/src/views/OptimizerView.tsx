import { useContext } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";
import type { OptimizationSettings } from "../store";

function EnemyProfileSlider({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="field" style={{ marginTop: 8 }}>
      <label>{label}</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value))))}
          style={{ width: 64, textAlign: "center" }}
        />
      </div>
      {hint && <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-dim, #aaa)" }}>{hint}</p>}
    </div>
  );
}

export function OptimizerView() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const o = store.optimization;
  const set = (patch: Partial<OptimizationSettings>) => store.setOptimization({ ...o, ...patch });

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

      <h3 style={{ margin: "18px 0 8px" }}>Einstellungen für Optimierung</h3>

      <div className="field">
        <label>Zielwert kritische Trefferchance (Standard 50 %, Bereich 10–60 %)</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="range"
            min={10}
            max={60}
            step={1}
            value={o.targetChc}
            onChange={(e) => set({ targetChc: Number(e.target.value) })}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            min={10}
            max={60}
            value={o.targetChc}
            onChange={(e) => set({ targetChc: Math.max(10, Math.min(60, Number(e.target.value))) })}
            style={{ width: 64, textAlign: "center" }}
          />
        </div>
      </div>

      <div className="field" style={{ marginTop: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={o.considerWeaponTalents}
            onChange={(e) => set({ considerWeaponTalents: e.target.checked })}
          />
          <span>Waffen-Talente berücksichtigen (Standard: ja)</span>
        </label>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-dim, #aaa)" }}>
          Beeinflusst nur Talente mit Voraussetzung. An: Bedingungen pauschal als erfüllt angenommen.
          Aus: bedingte Talente zählen nur, wenn der Build die Bedingung selbst liefern kann (z. B.
          Sadist-Blutung über Trauma-Weste oder Ongoing Directive) — Synergien werden im Ergebnis
          ausgewiesen. Magazin-abhängige Talente (Optimist, Strapaziert, Raserei) werden als Ø über
          ein volles Magazin berechnet (RPM, Magazingröße &amp; Nachladezeit aus der Waffen-DB).
        </p>
      </div>

      <div className="field" style={{ marginTop: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={o.considerGearTalents}
            onChange={(e) => set({ considerGearTalents: e.target.checked })}
          />
          <span>Ausrüstungs-Talente (Weste / Rucksack) berücksichtigen (Standard: ja)</span>
        </label>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-dim, #aaa)" }}>
          Beeinflusst nur Westen-/Rucksack-Talente mit Voraussetzung. An: Bedingungen pauschal als
          erfüllt angenommen. Aus: bedingte Ausrüstungs-Talente zählen nicht in die Berechnung.
          Unbedingte Talente (z. B. Glaskanone) gelten unabhängig davon als aktiv.
        </p>
      </div>

      <div className="field" style={{ marginTop: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={o.considerExoticPerks}
            onChange={(e) => set({ considerExoticPerks: e.target.checked })}
          />
          <span>Exotische Gear-Perks einrechnen (z. B. Catharsis, Memento, Coyote's Mask)</span>
        </label>
      </div>

      <div
        className="field"
        style={{
          marginTop: 12,
          padding: 10,
          border: "1px solid var(--border, #555)",
          borderRadius: 8,
        }}
      >
        <label style={{ fontWeight: 700 }}>
          Gegnerprofil (Annahmen für DTA / DTH / DTToOC)
        </label>
        <EnemyProfileSlider
          label="Rüstungs-Anteil (DTA)"
          value={o.enemyArmorShare}
          onChange={(v) => set({ enemyArmorShare: v, enemyHealthShare: 100 - v })}
        />
        <EnemyProfileSlider
          label="Lebensenergie-Anteil (DTH)"
          value={o.enemyHealthShare}
          onChange={(v) => set({ enemyHealthShare: v, enemyArmorShare: 100 - v })}
          hint="Rüstung + Lebensenergie ergänzen sich automatisch auf 100 %. „Nur Lebensenergie“ = Rüstung 0 % (DTA bringt dann nichts)."
        />
        <EnemyProfileSlider
          label="Ungedeckt-Anteil (DTToOC)"
          value={o.enemyOocShare}
          onChange={(v) => set({ enemyOocShare: v })}
          hint="Wie viel Schaden DTToOC tatsächlich verstärkt."
        />
        <EnemyProfileSlider
          label="Kopfschuss-Anteil (HSD)"
          value={o.enemyHeadshotShare}
          onChange={(v) => set({ enemyHeadshotShare: v })}
          hint="Anteil der Treffer, die auf den Kopf treffen. 0 % = Bodyshots only, 100 % = reiner Scharfschützen-Betrieb."
        />
      </div>

      <h3 style={{ margin: "18px 0 8px" }}>{t.optimizer.constraints}</h3>
      <div className="field">
        <label>{t.optimizer.exoticLimit}</label>
        <input type="checkbox" defaultChecked />
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
