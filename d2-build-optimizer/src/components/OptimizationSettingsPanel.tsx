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
      <div className="field">
        <label>Zielwert kritische Trefferchance (Standard 50 %, Bereich 10–60 %)</label>
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
        </div>
      </div>

      <div className="field" style={{ marginTop: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={optimization.considerWeaponTalents}
            onChange={(e) => set({ considerWeaponTalents: e.target.checked })}
          />
          <span>Waffen-Talente berücksichtigen (Standard: ja)</span>
        </label>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-dim, #aaa)" }}>
          Beeinflusst nur Talente mit Voraussetzung. An: Bedingungen pauschal als erfüllt angenommen.
          Aus: bedingte Talente zählen nur, wenn der Build die Bedingung selbst liefern kann (z. B.
          Sadist-Blutung über Trauma-Weste oder Ongoing Directive) — Synergien werden im Ergebnis
          ausgewiesen. Das Ergebnis zeigt getrennt, ob und mit welchem Bonus das Talent eingerechnet
          wurde. Magazin-abhängige Talente (Optimist, Strapaziert, Raserei) werden als Ø über ein
          volles Magazin berechnet (RPM, Magazingröße &amp; Nachladezeit aus der Waffen-DB).
        </p>
      </div>

      <div className="field" style={{ marginTop: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={optimization.considerGearTalents}
            onChange={(e) => set({ considerGearTalents: e.target.checked })}
          />
          <span>Ausrüstungs-Talente (Weste / Rucksack) berücksichtigen (Standard: ja)</span>
        </label>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-dim, #aaa)" }}>
          Beeinflusst nur Westen-/Rucksack-Talente mit Voraussetzung. An: Bedingungen pauschal als
          erfüllt angenommen. Aus: bedingte Ausrüstungs-Talente zählen nicht in die Berechnung.
          Unbedingte Talente (z. B. Glaskanone) gelten unabhängig davon als aktiv. Getrennt vom
          Schalter für bedingte Waffen-Talente.
        </p>
      </div>

      <div className="field" style={{ marginTop: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={optimization.considerExoticPerks}
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
          hint="Wie viel Schaden DTToOC tatsächlich verstärkt."
        />
        <EnemyProfileSlider
          label="Kopfschuss-Anteil (HSD)"
          value={optimization.enemyHeadshotShare}
          onChange={(v) => set({ enemyHeadshotShare: v })}
          hint="Anteil der Treffer, die auf den Kopf treffen. 0 % = Bodyshots only, 100 % = reiner Scharfschützen-Betrieb."
        />
      </div>
    </div>
  );
}
