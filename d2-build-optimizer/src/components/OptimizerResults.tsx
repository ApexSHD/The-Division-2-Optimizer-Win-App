import type { OptimizerResult } from "../data/damage";

function fmt(n: number) {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 0 });
}

export function OptimizerWarnings({ results }: { results: OptimizerResult[] }) {
  const messages = Array.from(new Set(results.flatMap((r) => r.warnings.map((wn) => wn.message))));
  if (messages.length === 0) return null;
  return (
    <div className="optimizer-warnings" style={{ marginBottom: 10 }}>
      {messages.slice(0, 3).map((msg) => (
        <div key={msg} className="warn-banner warn-yellow">⚠ {msg}</div>
      ))}
    </div>
  );
}

export function OptimizerResultsTable({
  results,
  showReasons,
}: {
  results: OptimizerResult[];
  showReasons?: boolean;
}) {
  return (
    <div className="table-wrap optimizer-results">
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
            <th>Rollen-Score</th>
            {showReasons && <th>Begründung</th>}
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
                {showReasons && <div style={{ color: "var(--text-dim, #aaa)" }}>{r.gear.length} Teil(e)</div>}
              </td>
              <td>+{r.stats.wd.toLocaleString("de-DE")} %</td>
              <td>{r.damage.cappedChc} %</td>
              <td>+{r.stats.chd.toLocaleString("de-DE")} %</td>
              <td>{fmt(r.damage.avgBulletDmg)}</td>
              <td><strong>{fmt(r.damage.effectiveDps)}</strong></td>
              <td style={{ fontSize: 11 }}>
                {r.roleScore.key ? (
                  <>
                    <strong>{r.roleScore.score.toLocaleString("de-DE")}</strong>
                    <div style={{ color: "var(--text-dim, #aaa)" }}>{r.roleScore.label}</div>
                  </>
                ) : (
                  <span style={{ color: "var(--text-dim, #aaa)" }}>Waffen-DPS</span>
                )}
              </td>
              {showReasons && (
                <td style={{ fontSize: 11 }}>
                  {r.reasonParts.map((part) => (
                    <div key={part} className="reason-line">{part}</div>
                  ))}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
