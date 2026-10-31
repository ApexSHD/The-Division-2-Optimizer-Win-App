import { useState } from "react";
import { useStore } from "../store";

const STEPS = [
  { key: "shd", title: "1 · Charakter" },
  { key: "import", title: "2 · Inventar importieren" },
  { key: "calc", title: "3 · Erstes Ergebnis" },
] as const;

export function OnboardingWizard() {
  const store = useStore();
  const [step, setStep] = useState<number>(0);

  const finish = () => {
    store.setOnboardingDone(true);
    store.setStatus("Ersteinrichtung abgeschlossen — viel Erfolg!");
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const hasWeapons = store.weapons.length > 0;
  const hasGear = store.gear.length > 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      role="dialog"
      aria-label="Geführte Ersteinrichtung"
    >
      <div
        className="field"
        style={{
          width: "min(640px, 92vw)",
          maxHeight: "88vh",
          overflow: "auto",
          display: "grid",
          gap: 12,
          background: "var(--bg, #1b1d21)",
          border: "1px solid var(--border, #555)",
          borderRadius: 10,
          padding: 20,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Willkommen — Ersteinrichtung in unter 3 Minuten</h2>
          <p style={{ margin: "4px 0 0", color: "var(--text-dim, #aaa)", fontSize: 13 }}>
            Drei Schritte bis zum ersten Build-Ergebnis. Du kannst die Ersteinrichtung jederzeit
            überspringen und später über „Global“ nachholen.
          </p>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className="tag"
              style={{
                padding: "2px 10px",
                borderRadius: 12,
                border: `1px solid ${i === step ? "var(--accent, #4f9cf9)" : "var(--border, #555)"}`,
                color: i === step ? "var(--accent, #4f9cf9)" : "var(--text-dim, #aaa)",
                fontSize: 12,
              }}
            >
              {s.title}
            </span>
          ))}
        </div>

        {step === 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            <label>
              SHD-Level (Standard 1.000) — bestimmt die Boni der SHD-Uhr
              <input
                type="number"
                min={0}
                max={10000}
                value={store.agent.shdLevel}
                onChange={(e) =>
                  store.setAgent({
                    ...store.agent,
                    shdLevel: Math.max(0, Math.min(10000, Number(e.target.value))),
                  })
                }
                style={{ width: 120, display: "block", marginTop: 4 }}
                autoFocus
              />
            </label>
            <label>
              Spezialisierung
              <select
                value={store.agent.spec}
                onChange={(e) => store.setAgent({ ...store.agent, spec: e.target.value })}
                style={{ display: "block", marginTop: 4, width: 220 }}
              >
                <option value="demolitionist">Granatwerfer</option>
                <option value="gunner">MG-Schütze</option>
                <option value="sharpshooter">Scharfschütze</option>
                <option value="survivalist">Überlebenskünstler</option>
                <option value="technician">Techniker</option>
                <option value="firewall">Firewall</option>
              </select>
            </label>
            <small style={{ color: "var(--text-dim, #aaa)" }}>
              Beides lässt sich später jederzeit unter „Global“ ändern.
            </small>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              Importiere deine CSV-Dateien aus dem Spiel. Der Import zeigt eine Vorschau mit
              Warnungen (z. B. doppelte Attribute), bevor etwas übernommen wird.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => store.setView("weapons")}>
                ⚔ Waffen importieren
              </button>
              <button className="btn" onClick={() => store.setView("gear")}>
                🛡 Gear importieren
              </button>
            </div>
            <div style={{ fontSize: 13, display: "grid", gap: 4 }}>
              <span>{hasWeapons ? `✓ ${store.weapons.length} Waffe(n) erfasst` : "○ Noch keine Waffen erfasst"}</span>
              <span>{hasGear ? `✓ ${store.gear.length} Gear-Teil(e) erfasst` : "○ Noch keine Gear-Teile erfasst"}</span>
            </div>
            <small style={{ color: "var(--text-dim, #aaa)" }}>
              Tipp: CSV-Dateien können auch per Drag & Drop in die Ansichten gezogen werden. Nach
              dem Import kehrst du hierher zurück (Dialog bleibt geöffnet, solange kein Inventar
              vorhanden ist).
            </small>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              Alles bereit: Wähle im Optimierer eine Rolle und klicke auf „Builds berechnen“.
              Standardwerte (Gegnerprofil, CHC-Ziel, Dauer-DPS) sind bereits sinnvoll gesetzt —
              das erste Ergebnis kommt mit einem Klick.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => store.setView("optimizer")}>
                🎯 Zum Optimierer
              </button>
            </div>
            <small style={{ color: "var(--text-dim, #aaa)" }}>
              Bedienung: Ziel/Rolle wählen → „Builds berechnen“ → Ergebnis als Loadout speichern.
              Details zu Annahmen und nicht modellierten Effekten stehen im Ergebnis-Banner.
            </small>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn" onClick={finish} title="Ersteinrichtung überspringen">
            Überspringen
          </button>
          <span className="spacer" />
          {step > 0 && (
            <button className="btn" onClick={back}>
              Zurück
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button className="btn btn-accent" onClick={next}>
              Weiter
            </button>
          ) : (
            <button className="btn btn-accent" onClick={finish}>
              Fertig — Los geht's
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
