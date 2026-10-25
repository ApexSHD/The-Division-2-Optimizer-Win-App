import type { OptimizationSettings } from "../store";

function CheckRow({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint?: string;
}) {
  return (
    <label className="check-row" style={{ marginTop: 10 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="check-text">
        <span style={{ fontWeight: 600 }}>{title}</span>
        {hint && <p className="settings-hint">{hint}</p>}
      </span>
    </label>
  );
}

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
    <div className="field" style={{ marginTop: 10 }}>
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
      {hint && <p className="settings-hint">{hint}</p>}
    </div>
  );
}

export function OptimizationSettingsPanel({
  optimization,
  onChange,
}: {
  optimization: OptimizationSettings;
  onChange: (o: OptimizationSettings) => void;
}) {
  const set = (patch: Partial<OptimizationSettings>) => onChange({ ...optimization, ...patch });

  return (
    <div>
      <section className="settings-section">
        <h4 className="settings-section-title">Allgemeine Optimierung</h4>
        <div className="field" style={{ marginTop: 6 }}>
          <label>Zielwert kritische Trefferchance</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="range"
              min={10}
              max={60}
              step={1}
              value={optimization.targetChc}
              onChange={(e) => set({ targetChc: Number(e.target.value) })}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min={10}
              max={60}
              value={optimization.targetChc}
              onChange={(e) => set({ targetChc: Math.max(10, Math.min(60, Number(e.target.value))) })}
              style={{ width: 64, textAlign: "center" }}
            />
            <span style={{ fontSize: 12, color: "var(--text-dim, #aaa)" }}>%</span>
          </div>
          <p className="settings-hint">Standard 50 %, erlaubter Bereich 10–60 %.</p>
        </div>
      </section>

      <section className="settings-section">
        <h4 className="settings-section-title">Talente</h4>
        <CheckRow
          checked={optimization.considerWeaponTalents}
          onChange={(v) => set({ considerWeaponTalents: v })}
          title="Waffen-Talente berücksichtigen"
          hint="Beeinflusst nur Talente mit Voraussetzung. An (Standard): Bedingungen pauschal als erfüllt angenommen. Aus: bedingte Talente zählen nur, wenn der Build die Bedingung selbst liefern kann (z. B. Sadist-Blutung über Trauma-Weste oder Ongoing Directive) — Synergien werden im Ergebnis ausgewiesen. Das Ergebnis zeigt getrennt, ob und mit welchem Bonus das Talent eingerechnet wurde. Magazin-abhängige Talente (Optimist, Strapaziert, Raserei) werden als Ø über ein volles Magazin berechnet (RPM, Magazingröße & Nachladezeit aus der Waffen-DB)."
        />
        <CheckRow
          checked={optimization.considerGearTalents}
          onChange={(v) => set({ considerGearTalents: v })}
          title="Ausrüstungs-Talente (Weste / Rucksack) berücksichtigen"
          hint="Beeinflusst nur Westen-/Rucksack-Talente mit Voraussetzung. An (Standard): Bedingungen pauschal als erfüllt angenommen. Aus: bedingte Ausrüstungs-Talente zählen nicht in die Berechnung. Unbedingte Talente (z. B. Glaskanone) gelten unabhängig davon als aktiv. Getrennt vom Schalter für bedingte Waffen-Talente."
        />
        <CheckRow
          checked={optimization.considerExoticPerks}
          onChange={(v) => set({ considerExoticPerks: v })}
          title="Exotische Gear-Perks einrechnen"
          hint="Z. B. Catharsis, Memento, Coyote's Mask."
        />
      </section>

      <section className="settings-section">
        <h4 className="settings-section-title">Gegnerprofil (Annahmen für DTA / DTH / DTToOC)</h4>
        <p className="settings-hint" style={{ marginTop: 0 }}>
          Gewichtet, wie viel des Kampfes gegen die Rüstungs- bzw. Lebensenergie-Leiste
          stattfindet; der Ungedeckt-Anteil bestimmt, wie viel Schaden DTToOC tatsächlich verstärkt.
        </p>
        <EnemyProfileSlider
          label="Rüstungs-Anteil (DTA)"
          value={optimization.enemyArmorShare}
          onChange={(v) => set({ enemyArmorShare: v, enemyHealthShare: 100 - v })}
        />
        <EnemyProfileSlider
          label="Lebensenergie-Anteil (DTH)"
          value={optimization.enemyHealthShare}
          onChange={(v) => set({ enemyHealthShare: v, enemyArmorShare: 100 - v })}
          hint="Rüstung + Lebensenergie ergänzen sich automatisch auf 100 %. „Nur Lebensenergie“ = Rüstung 0 % (DTA bringt dann nichts)."
        />
        <EnemyProfileSlider
          label="Ungedeckt-Anteil (DTToOC)"
          value={optimization.enemyOocShare}
          onChange={(v) => set({ enemyOocShare: v })}
        />
        <EnemyProfileSlider
          label="Kopfschuss-Anteil (HSD)"
          value={optimization.enemyHeadshotShare}
          onChange={(v) => set({ enemyHeadshotShare: v })}
          hint="Anteil der Treffer, die auf den Kopf treffen. 0 % = Bodyshots only, 100 % = reiner Scharfschützen-Betrieb."
        />
      </section>
    </div>
  );
}
