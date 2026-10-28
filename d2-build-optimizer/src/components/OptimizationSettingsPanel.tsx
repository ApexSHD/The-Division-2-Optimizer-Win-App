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
        <div className="hint" style={{ padding: "8px 10px" }}>
          Talente, Exotic-Perks und Stack-Effekte werden aktuell <strong>nicht</strong> in die
          Berechnung eingerechnet (siehe Annahmen-Panel je Ergebnis und docs/FORMELN.md Abschnitt 8).
          Die Einbindung ist als Feature geplant.
        </div>
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
