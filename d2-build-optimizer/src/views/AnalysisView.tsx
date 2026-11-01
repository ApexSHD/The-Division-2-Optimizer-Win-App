import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";
import { DataTable } from "../components/DataTable";
import { WEAPON_TYPE_LABELS } from "../data/inventoryAnalysis";
import type { AnalysisTabId, InventoryAnalysis } from "../data/inventoryAnalysis";
import type { ModeContext } from "../data/operatingModes";
import { runAnalysisAsync } from "../workers/analysisClient";
import { tWeaponName, tTalentName, tGearSetName, type ItemLang } from "../i18n/itemNames";
import type { GearSlot } from "../data/sampleData";

const TABS: { key: AnalysisTabId; icon: string }[] = [
  { key: "overview", icon: "📊" },
  { key: "gear", icon: "🧥" },
  { key: "weapons", icon: "🔫" },
  { key: "sets", icon: "🧩" },
  { key: "gaps", icon: "🎯" },
  { key: "cleanup", icon: "🧹" },
];

function Bar({ value, max = 1, label }: { value: number; max?: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }} role="img" aria-label={`${label}: ${Math.round(pct)} %`}>
      <div style={{ width: 140, height: 10, background: "var(--bg-panel)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent, #e8862e)" }} />
      </div>
      <span style={{ fontSize: 12 }}>{label}</span>
    </div>
  );
}

export function AnalysisView() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const itemLang: ItemLang = store.lang;
  const [tab, setTab] = useState<AnalysisTabId>("overview");

  const [analysis, setAnalysis] = useState<InventoryAnalysis | null>(null);
  const [calcState, setCalcState] = useState<"idle" | "running" | "cancelled">("idle");
  const [progress, setProgress] = useState<{ phase: string; done: number; total: number }>({ phase: "", done: 0, total: 0 });
  const runRef = useRef(0);

  const gearDep = store.gear;
  const weaponsDep = store.weapons;
  const buildsDep = store.builds;
  const optDep = store.optimization;
  const agentDep = store.agent;

  useEffect(() => {
    const generation = ++runRef.current;
    const ctx: ModeContext = {
      mode: "inventar",
      roleKey: store.optimization.role || "weaponDps",
      skills: [],
      teamSize: store.optimization.enemyTeamSize,
      shdLevel: store.agent.shdLevel,
      settings: store.optimization,
      threatStatusShare: 0.3,
      spec: store.agent.spec,
    };
    setCalcState("running");
    setProgress({ phase: "", done: 0, total: 0 });
    const handle = runAnalysisAsync(
      {
        gear: store.gear,
        weapons: store.weapons,
        builds: store.builds,
        roleId: store.optimization.role || "weaponDps",
        ctx,
        keepMarkedIds: [],
      },
      (phase, done, total) => {
        if (generation !== runRef.current) return;
        setProgress({ phase, done, total });
      },
    );
    handle.promise
      .then((a) => {
        if (generation !== runRef.current) return;
        setAnalysis(a);
        setCalcState("idle");
      })
      .catch(() => {
        if (generation !== runRef.current) return;
        setCalcState("cancelled");
      });
    return () => {
      handle.cancel();
    };
  }, [gearDep, weaponsDep, buildsDep, optDep, agentDep]);

  const cancelAnalysis = () => {
    runRef.current += 1;
    setCalcState("cancelled");
  };

  const a = t.analysis;
  const gearById = useMemo(() => new Map(store.gear.map((g) => [g.id, g])), [store.gear]);
  const weaponById = useMemo(() => new Map(store.weapons.map((w) => [w.id, w])), [store.weapons]);

  if (!analysis) {
    return (
      <div>
        <div className="toolbar">
          <span className="badge">{a.calculating}</span>
          <span className="badge">{progress.phase} {progress.total > 0 ? `${progress.done}/${progress.total}` : ""}</span>
          <span className="spacer" />
          <button className="btn" onClick={cancelAnalysis}>{a.cancel}</button>
        </div>
        <div className="empty-state" style={{ padding: 24 }}>{a.calculating}</div>
      </div>
    );
  }

  const smallInventory = analysis.gearTotal < 6 || analysis.weaponTotal < 3;

  function jumpToGear(slot?: GearSlot) {
    store.setView("gear");
    if (slot) store.setStatus(`${a.drilldownGear}: ${t.gear.slots[slot]}`);
  }

  return (
    <div>
      <div className="toolbar">
        <span className="badge">Stand: {new Date(analysis.analyzedAt).toLocaleString(store.lang === "de" ? "de-DE" : "en-US")}</span>
        {smallInventory && <span className="badge">{a.smallInventoryHint}</span>}
        {calcState === "running" && (
          <>
            <span className="badge">{a.calculating} {progress.phase} {progress.total > 0 ? `${progress.done}/${progress.total}` : ""}</span>
            <button className="btn" onClick={cancelAnalysis}>{a.cancel}</button>
          </>
        )}
        {calcState === "cancelled" && <span className="badge">{a.cancelled}</span>}
        <span className="spacer" />
      </div>

      <div className="tabs" role="tablist" aria-label={a.title}>
        {TABS.map((tb) => (
          <button
            key={tb.key}
            role="tab"
            aria-selected={tab === tb.key}
            className={`tab ${tab === tb.key ? "active" : ""}`}
            onClick={() => setTab(tb.key)}
          >
            {tb.icon} {a.tabs[tb.key]}
          </button>
        ))}
      </div>

      {analysis.gearTotal === 0 && analysis.weaponTotal === 0 && (
        <div className="empty-state" style={{ padding: 24 }}>
          {a.empty}
        </div>
      )}

      {tab === "overview" && analysis.gearTotal + analysis.weaponTotal > 0 && (
        <div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <div className="badge" style={{ fontSize: 14, padding: "8px 14px" }}>{a.health}: {analysis.health.total}/100</div>
            <div className="badge" style={{ fontSize: 14, padding: "8px 14px" }}>{a.gearCount}: {analysis.gearTotal}</div>
            <div className="badge" style={{ fontSize: 14, padding: "8px 14px" }}>{a.weaponCount}: {analysis.weaponTotal}</div>
            <div className="badge" style={{ fontSize: 14, padding: "8px 14px" }}>{a.exotics}: {analysis.exoticGearCount + analysis.weaponRarity.exotic}</div>
            <div className="badge" style={{ fontSize: 14, padding: "8px 14px" }}>{a.prototypeShare}: {Math.round(analysis.prototypeShare * 100)} %</div>
          </div>
          <h3 style={{ margin: "8px 0" }}>{a.insights}</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {analysis.insights.map((ins) => (
              <li key={ins.id} style={{ marginBottom: 6 }}>
                {ins.severity === "warning" ? "⚠ " : "ℹ "}
                {ins.text}{" "}
                <button className="btn" style={{ fontSize: 11, padding: "1px 8px" }} onClick={() => setTab(ins.tab)}>
                  → {a.tabs[ins.tab]}
                </button>
              </li>
            ))}
          </ul>
          <h3 style={{ margin: "16px 0 8px" }}>{a.healthBreakdown}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Bar value={analysis.health.slotCoverage} max={20} label={a.healthSlots} />
            <Bar value={analysis.health.coreColors} max={20} label={a.healthCores} />
            <Bar value={analysis.health.weaponTypes} max={20} label={a.healthWeaponTypes} />
            <Bar value={analysis.health.rollQuality} max={25} label={a.healthRolls} />
            <Bar value={analysis.health.setCoverage} max={15} label={a.healthSets} />
          </div>
        </div>
      )}

      {tab === "gear" && analysis.gearTotal > 0 && (
        <div>
          <h3 style={{ margin: "8px 0" }}>{a.slotCoreMatrix}</h3>
          <table aria-label={a.slotCoreMatrix}>
            <thead>
              <tr>
                <th>{a.slot}</th>
                <th>{a.coreRot}</th>
                <th>{a.coreBlau}</th>
                <th>{a.coreGelb}</th>
              </tr>
            </thead>
            <tbody>
              {analysis.slotCoreMatrix.map((row) => (
                <tr key={row.slot}>
                  <td>
                    <button className="btn" style={{ fontSize: 12 }} onClick={() => jumpToGear(row.slot)}>
                      {t.gear.slots[row.slot]}
                    </button>
                  </td>
                  <td style={row.rot === 0 ? { color: "var(--danger, #e05252)", fontWeight: 600 } : undefined}>{row.rot}</td>
                  <td style={row.blau === 0 ? { color: "var(--danger, #e05252)", fontWeight: 600 } : undefined}>{row.blau}</td>
                  <td style={row.gelb === 0 ? { color: "var(--danger, #e05252)", fontWeight: 600 } : undefined}>{row.gelb}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ margin: "16px 0 8px" }}>{a.rollQuality}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {analysis.rollQualityClasses.map((c) => (
              <Bar
                key={c.label}
                value={c.count}
                max={analysis.gearTotal}
                label={`${a[`roll_${c.label}` as "roll_top"]} – ${c.count}`}
              />
            ))}
          </div>
          <DataTable
            rows={analysis.rollQuality}
            rowKey={(r) => r.pieceId}
            columns={[
              { key: "slot", label: a.slot, render: (r) => t.gear.slots[r.slot] },
              { key: "brand", label: a.brand, render: (r) => r.brand, sortValue: (r) => r.brand },
              { key: "ratio", label: a.rollQuality, render: (r) => `${Math.round(r.ratio * 100)} %`, sortValue: (r) => r.ratio },
              { key: "klass", label: a.klass, render: (r) => a[`roll_${r.klass}` as "roll_top"] },
            ]}
          />

          {analysis.dataQualityIssues.length > 0 && (
            <>
              <h3 style={{ margin: "16px 0 8px" }}>{a.dataQuality}</h3>
              <ul>{analysis.dataQualityIssues.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </>
          )}
        </div>
      )}

      {tab === "weapons" && analysis.weaponTotal > 0 && (
        <div>
          <h3 style={{ margin: "8px 0" }}>{a.typeCoverage}</h3>
          <DataTable
            rows={analysis.weaponTypeCoverage}
            rowKey={(c) => c.type}
            columns={[
              { key: "type", label: a.weaponType, render: (c) => WEAPON_TYPE_LABELS[c.type], sortValue: (c) => c.type },
              { key: "count", label: a.count, render: (c) => (c.count === 0 ? <strong style={{ color: "var(--danger, #e05252)" }}>0 ⚠</strong> : c.count), sortValue: (c) => c.count },
              {
                key: "best",
                label: a.bestWeapon,
                render: (c) => {
                  const w = c.bestWeaponId ? weaponById.get(c.bestWeaponId) : null;
                  return w ? tWeaponName(w.name, itemLang, w.name) : "–";
                },
              },
            ]}
          />
          {analysis.weaponFamilies.length > 0 && (
            <>
              <h3 style={{ margin: "16px 0 8px" }}>{a.variants}</h3>
              <DataTable
                rows={analysis.weaponFamilies}
                rowKey={(f) => f.name}
                columns={[
                  { key: "name", label: a.weapon, render: (f) => tWeaponName(f.name, itemLang, f.name), sortValue: (f) => f.name },
                  { key: "count", label: a.variantsCount, render: (f) => `×${f.count}`, sortValue: (f) => f.count },
                  {
                    key: "talents",
                    label: a.talents,
                    render: (f) => f.weaponIds.map((id) => weaponById.get(id)?.talent ?? "").filter(Boolean).map((tal) => tTalentName(tal, itemLang, tal)).join(", "),
                  },
                ]}
              />
            </>
          )}
          {analysis.talentCounts.length > 0 && (
            <>
              <h3 style={{ margin: "16px 0 8px" }}>{a.talentCoverage}</h3>
              <DataTable
                rows={analysis.talentCounts}
                rowKey={(x) => x.talent}
                columns={[
                  { key: "talent", label: a.talent, render: (x) => tTalentName(x.talent, itemLang, x.talent), sortValue: (x) => x.talent },
                  { key: "count", label: a.count, render: (x) => x.count, sortValue: (x) => x.count },
                ]}
              />
            </>
          )}
        </div>
      )}

      {tab === "sets" && analysis.gearTotal > 0 && (
        <div>
          <DataTable
            rows={analysis.setProgress}
            rowKey={(s) => s.key}
            columns={[
              { key: "name", label: a.set, render: (s) => (s.kind === "gearset" ? tGearSetName(s.name, itemLang, s.name) : s.name), sortValue: (s) => s.name },
              { key: "kind", label: a.kind, render: (s) => (s.kind === "gearset" ? a.gearset : a.brand) },
              { key: "pieces", label: a.pieces, render: (s) => `${s.pieces}/6`, sortValue: (s) => s.pieces },
              { key: "slots", label: a.slots, render: (s) => s.slots.map((sl) => t.gear.slots[sl]).join(", ") },
              { key: "bonuses", label: a.reachedBonuses, render: (s) => s.reachedBonuses.map((b) => `${b.pieces}p`).join(" · ") || "–" },
            ]}
          />
          {analysis.setConflicts.length > 0 && (
            <>
              <h3 style={{ margin: "16px 0 8px" }}>⚠ {a.conflicts}</h3>
              <ul>
                {analysis.setConflicts.map((c, i) => (
                  <li key={i}>
                    {c.a} ↔ {c.b}: {c.sharedSlots.map((s) => t.gear.slots[s]).join(", ")}
                  </li>
                ))}
              </ul>
            </>
          )}
          {analysis.exoticLimitViolation && (
            <div className="hint" style={{ marginTop: 12 }}>⚠ {a.exoticLimitHint}</div>
          )}
        </div>
      )}

      {tab === "gaps" && (
        <div>
          {analysis.reachabilityByRole.length > 0 && (
            <>
              <h3 style={{ margin: "8px 0" }}>{a.reachability}</h3>
              <DataTable
                rows={analysis.reachabilityByRole}
                rowKey={(r) => r.roleId}
                columns={[
                  { key: "role", label: a.role, render: (r) => r.roleId, sortValue: (r) => r.roleId },
                  {
                    key: "pct",
                    label: a.reachability,
                    render: (r) => (r.reachabilityPercent === null ? "–" : `${r.reachabilityPercent.toLocaleString(store.lang === "de" ? "de-DE" : "en-US")} %`),
                    sortValue: (r) => r.reachabilityPercent ?? -1,
                  },
                ]}
              />
            </>
          )}
          <h3 style={{ margin: "16px 0 8px" }}>{a.recommendations}</h3>
          {analysis.gapRecommendations.length === 0 ? (
            <div className="hint">{a.noRecommendations}</div>
          ) : (
            <DataTable
              rows={analysis.gapRecommendations}
              rowKey={(r) => `${r.rank}-${r.slot}`}
              columns={[
                { key: "rank", label: "#", render: (r) => r.rank, sortValue: (r) => r.rank },
                { key: "slot", label: a.slot, render: (r) => t.gear.slots[r.slot] },
                { key: "target", label: a.target, render: (r) => r.targetName },
                {
                  key: "gain",
                  label: a.gainPercent,
                  render: (r) => (r.gainPercent === null ? "–" : `+${r.gainPercent.toLocaleString(store.lang === "de" ? "de-DE" : "en-US")} %`),
                  sortValue: (r) => r.gainPercent ?? -1,
                },
                { key: "stage", label: a.stage, render: (r) => r.stage },
                { key: "source", label: a.source, render: (r) => r.source.game_activity[0] ?? r.source.item },
              ]}
            />
          )}
          <div className="hint" style={{ marginTop: 12 }}>{a.upgradeExcludedHint}</div>
        </div>
      )}

      {tab === "cleanup" && (
        <div>
          {analysis.cleanupCandidates.length === 0 ? (
            <div className="hint">{a.noCandidates}</div>
          ) : (
            <DataTable
              rows={analysis.cleanupCandidates}
              rowKey={(c) => c.pieceId}
              columns={[
                { key: "piece", label: a.piece, render: (c) => gearById.get(c.pieceId)?.brand ?? c.pieceId, sortValue: (c) => gearById.get(c.pieceId)?.brand ?? "" },
                { key: "slot", label: a.slot, render: (c) => (gearById.get(c.pieceId) ? t.gear.slots[gearById.get(c.pieceId)!.slot] : "–") },
                { key: "kind", label: a.kind, render: (c) => a[`kind_${c.kind}` as "kind_duplicate"] },
                { key: "reason", label: a.reason, render: (c) => c.reason },
                {
                  key: "open",
                  label: "",
                  render: (c) => (
                    <button className="btn" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => jumpToGear(gearById.get(c.pieceId)?.slot)}>
                      {a.open}
                    </button>
                  ),
                },
              ]}
            />
          )}
          <div className="hint" style={{ marginTop: 12 }}>{a.cleanupHint}</div>
        </div>
      )}
    </div>
  );
}
