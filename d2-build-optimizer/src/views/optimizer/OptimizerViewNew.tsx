import { useContext, useMemo, useState } from "react";
import { useStore } from "../../store";
import { I18nContext } from "../../i18n";
import { RequestPanel } from "./RequestPanel";
import { BuildCard, saveCandidateAsLoadout } from "./BuildCard";
import { useOptimizerRun } from "./useOptimizerRun";
import { optimizerFingerprint } from "./requestFingerprint";
import { computeInventoryCheck } from "./inventoryCheck";
import { setBonusCatalogFromDb } from "../../data/db";
import modsJson from "../../db/mod.json";
import type { ModeContext } from "../../data/operatingModes";
import { analyzeInventory, type GapRecommendationEntry } from "../../data/inventoryAnalysis";

export function OptimizerViewNew() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const o = t.optimizer;
  const req = store.optimizerRequest;
  const setReq = store.setOptimizerRequest;
  const run = useOptimizerRun();
  const [idx, setIdx] = useState(0);
  const [improvements, setImprovements] = useState<GapRecommendationEntry[] | null>(null);

  const check = useMemo(() => computeInventoryCheck(store.gear, store.weapons), [store.gear, store.weapons]);
  const fingerprint = useMemo(() => optimizerFingerprint(req, store.weapons, store.gear), [req, store.weapons, store.gear]);
  const stale = store.lastOptimizerFingerprint !== null && store.lastOptimizerFingerprint !== fingerprint;

  const empty = store.gear.length === 0 && store.weapons.length === 0;

  const runCalculation = () => {
    if (store.weapons.length === 0 || store.gear.length === 0) return;
    const ctx: ModeContext = {
      mode: "inventar",
      roleKey: req.roleKey,
      skills: [],
      teamSize: req.teamSize,
      shdLevel: store.agent.shdLevel,
      settings: {
        ...store.optimization,
        targetMetric: req.targetMetric,
        targetChc: req.targetChc,
        targetHsd: req.targetHsd,
        difficultyKey: req.difficultyKey,
        gameMode: req.gameMode,
        enemyTeamSize: req.teamSize,
        lockedGearIds: req.lockedGearIds,
        excludedGearIds: req.excludedGearIds,
        excludedWeaponIds: req.excludedWeaponIds,
        targetGearSet: req.targetGearSet,
        weaponTypeFilter: req.weaponTypeFilter,
        anchorWeaponId: req.anchorWeaponId,
      },
      threatStatusShare: 0.3,
      spec: req.spec,
    };
    const modsBySlot = (modsJson as unknown as {
      slots: Record<string, Array<{ name: string; slotTypes: string[]; bonus: { type: string; val: number } | null; penalty?: { type: string; val: number } | null }>>;
    }).slots;
    run.run(store.weapons, store.gear, ctx, {
      maxResults: 5,
      setBonusCatalog: store.db ? setBonusCatalogFromDb(store.db) : undefined,
      modsBySlot,
    });
  };

  const onResult = (fp: string) => {
    store.setLastOptimizerFingerprint(fp);
    const inv = run.result;
    if (inv) {
      const analysis = analyzeInventory({
        gear: store.gear,
        weapons: store.weapons,
        builds: store.builds,
        roleId: req.roleKey,
        ctx: {
          mode: "inventar",
          roleKey: req.roleKey,
          skills: [],
          teamSize: req.teamSize,
          shdLevel: store.agent.shdLevel,
          settings: { ...store.optimization, targetMetric: req.targetMetric, targetChc: req.targetChc, difficultyKey: req.difficultyKey, gameMode: req.gameMode, enemyTeamSize: req.teamSize, lockedGearIds: req.lockedGearIds, excludedGearIds: req.excludedGearIds, excludedWeaponIds: req.excludedWeaponIds },
          threatStatusShare: 0.3,
          spec: req.spec,
        },
      });
      setImprovements(analysis.gapRecommendations);
    }
  };

  if (run.result && store.lastOptimizerFingerprint !== fingerprint) {
    // Ergebnis wurde für anderen Stand berechnet — Fingerprint beim Anzeigen setzen
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 380px) 1fr", gap: 16, alignItems: "start" }}>
      <div style={{ display: "grid", gap: 10 }}>
        <section className="field" style={{ padding: 12 }}>
          <h2 style={{ margin: 0 }}>{o.title}</h2>
          <p style={{ margin: "4px 0 0", color: "var(--text-dim, #aaa)", fontSize: 13 }}>{o.subtitle}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button
              className="btn btn-primary"
              onClick={runCalculation}
              disabled={run.running || store.gear.length === 0 || store.weapons.length === 0}
            >
              {run.running ? o.calculating : o.calculate}
            </button>
            {run.running && (
              <button className="btn" onClick={run.cancel}>{o.cancel}</button>
            )}
          </div>
          {run.running && run.progress && (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              {o.progress}: {run.progress.phase} {run.progress.total > 0 ? `${run.progress.done}/${run.progress.total}` : ""}
            </div>
          )}
          {run.cancelled && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--warn, #e6a23c)" }}>
              {o.cancelled} <button className="btn" style={{ fontSize: 11 }} onClick={runCalculation}>{o.retry}</button>
            </div>
          )}
        </section>

        <section className="field" style={{ padding: 12 }}>
          <strong>{o.inventoryCheck}</strong>
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <span className="badge">✓ {check.gearCount} {o.gearCount}</span>
            <span className="badge">✓ {check.weaponCount} {o.weaponCount}</span>
            {!check.hasPistol && <span className="badge" style={{ color: "var(--warn, #e6a23c)" }}>⚠ {o.noPistol}</span>}
            {check.missingWeaponTypes.length > 0 && (
              <span className="badge" style={{ color: "var(--warn, #e6a23c)" }}>⚠ {o.missingWeaponTypes}: {check.missingWeaponTypes.join(", ")}</span>
            )}
          </div>
        </section>

        <RequestPanel request={req} onChange={setReq} />
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {empty && (
          <section className="field" style={{ padding: 24 }}>
            <p>{o.emptyInventory}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => store.setView("weapons")}>{o.goImportWeapons}</button>
              <button className="btn" onClick={() => store.setView("gear")}>{o.goImportGear}</button>
            </div>
          </section>
        )}

        {!run.result && !run.running && !empty && (
          <section className="field" style={{ padding: 24, color: "var(--text-dim, #aaa)" }}>
            {o.subtitle}
          </section>
        )}

        {run.result && run.result.ranked.length > 0 && (
          <>
            <BuildCard
              result={run.result}
              ranked={run.result.ranked[Math.min(idx, run.result.ranked.length - 1)]}
              index={Math.min(idx, run.result.ranked.length - 1)}
              onPrev={() => setIdx((i) => Math.max(0, i - 1))}
              onNext={() => setIdx((i) => Math.min(run.result!.ranked.length - 1, i + 1))}
              total={run.result.ranked.length}
              request={req}
              stale={stale}
              onSaveLoadout={(cand, name) => {
                const build = saveCandidateAsLoadout(store, cand, name, req.roleKey, req);
                onResult(fingerprint);
                setIdx(0);
                void build;
              }}
              onShare={(cand) => {
                const lines = [
                  `${req.roleKey} — ${cand.weapon.name}`,
                  ...cand.weapons.filter((w) => w.weapon).map((w) => `${w.slot}: ${w.weapon!.name}`),
                  ...cand.gear.map((g) => `${g.slot}: ${g.brand} (${g.core} ${g.coreValue})`),
                  `DPS ${Math.round(cand.damage.sustainedDps)} · CHC ${cand.damage.cappedChc.toFixed(1)} % · CHD ${cand.damage.finalChd.toFixed(1)} %`,
                ];
                void navigator.clipboard?.writeText(lines.join("\n"));
              }}
            />
            {improvements && improvements.length > 0 && (
              <section className="field" style={{ padding: 12 }}>
                <strong>{o.improvements}</strong>
                <table style={{ width: "100%", marginTop: 6, fontSize: 13 }}>
                  <thead>
                    <tr><th style={{ textAlign: "left" }}>#</th><th style={{ textAlign: "left" }}>{o.role === "Rolle" ? "Slot" : "Slot"}</th><th style={{ textAlign: "left" }}>{t.analysis.target}</th><th style={{ textAlign: "left" }}>{t.analysis.gainPercent}</th><th style={{ textAlign: "left" }}>{t.analysis.source}</th></tr>
                  </thead>
                  <tbody>
                    {improvements.map((r) => (
                      <tr key={`${r.rank}-${r.slot}`}>
                        <td>{r.rank}</td>
                        <td>{r.slot}</td>
                        <td>{r.targetName}</td>
                        <td>{r.gainPercent === null ? "–" : `+${r.gainPercent} %`}</td>
                        <td>{r.source.game_activity[0] ?? r.source.item}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}

        {run.result && run.result.ranked.length === 0 && (
          <section className="field" style={{ padding: 24 }}>
            <strong>{o.noAdmissible}</strong>
            <p style={{ color: "var(--text-dim, #aaa)" }}>{run.result.noAdmissibleHint ?? ""}</p>
          </section>
        )}
      </div>
    </div>
  );
}
