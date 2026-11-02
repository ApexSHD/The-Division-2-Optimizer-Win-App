import { useContext, useMemo, useState } from "react";
import { useStore, type OptimizerRequest } from "../../store";
import { I18nContext } from "../../i18n";
import type { V4BuildResult, V4Candidate } from "../../data/operatingModes";
import { roleProfile } from "../../data/roleProfiles";
import { DB_VERSION, type Loadout, type WeaponMod } from "../../data/sampleData";
import { bestGearModsForRole } from "../../data/operatingModes";
import { bestModsForWeapon } from "../../data/damage";
import { weaponFingerprint, gearFingerprint } from "../../data/loadoutIntegrity";
import modsJson from "../../db/mod.json";
import type { ScoredBuild } from "../../data/roleProfiles";

const SLOT_ORDER = ["mask", "chest", "holster", "backpack", "gloves", "kneepads"] as const;
const SLOT_LABEL_DE: Record<string, string> = {
  mask: "Maske", chest: "Weste", holster: "Holster", backpack: "Rucksack", gloves: "Handschuhe", kneepads: "Knieschoner",
};

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

export function BuildCard({
  result,
  ranked,
  index,
  onPrev,
  onNext,
  total,
  request,
  stale,
  onSaveLoadout,
  onShare,
}: {
  result: V4BuildResult;
  ranked: ScoredBuild;
  index: number;
  onPrev: () => void;
  onNext: () => void;
  total: number;
  request: OptimizerRequest;
  stale: boolean;
  onSaveLoadout: (cand: V4Candidate, name: string) => void;
  onShare: (cand: V4Candidate) => void;
}) {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const o = t.optimizer;
  const [name, setName] = useState("");
  const cand = result.candidates.find((c) => c.id === ranked.id);
  const role = roleProfile(request.roleKey);
  const active = store.builds.find((b) => b.id === store.activeBuildId);
  const activeMetrics = active?.metrics ?? null;

  const kpis = useMemo(() => {
    if (!cand) return null;
    const metric = request.targetMetric === "burst" ? cand.damage.effectiveDps : request.targetMetric === "rotation" ? ranked.vector.dps : cand.damage.sustainedDps;
    return {
      dps: metric,
      chc: cand.damage.cappedChc,
      chd: cand.damage.finalChd,
      wd: cand.stats.wd,
      armor: Math.round(cand.vector.ehp),
    };
  }, [cand, request.targetMetric, ranked]);

  if (!cand || !kpis) return null;

  const delta = (v: number, activeV: number | undefined) => {
    if (activeV === undefined) return null;
    const d = v - activeV;
    return { d, up: d > 0, down: d < 0 };
  };

  const weaponSlots = cand.weapons;

  return (
    <section className="field" style={{ padding: 14, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <strong>{o.result}</strong>
        <span className="badge">{o.buildOf.replace("{cur}", String(index + 1)).replace("{total}", String(total))}</span>
        <button className="btn" onClick={onPrev} disabled={index === 0} aria-label={o.prev}>‹ {o.prev}</button>
        <button className="btn" onClick={onNext} disabled={index >= total - 1} aria-label={o.next}>{o.next} ›</button>
        {stale && <span className="badge" style={{ color: "var(--warn, #e6a23c)" }}>⚠ {o.stale}</span>}
        <span className="spacer" />
      </div>

      <div>
        <strong>{o.weapons}</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 6 }}>
          {weaponSlots.map((ws) => (
            <div key={ws.slot} className="badge" style={{ padding: "6px 8px", display: "grid", gap: 2 }}>
              <span style={{ fontSize: 10, color: "var(--text-dim, #aaa)" }}>
                {ws.slot === "primary1" ? o.primary1 : ws.slot === "primary2" ? o.primary2 : o.pistol}
              </span>
              {ws.weapon ? (
                <span>{ws.weapon.name} <small>({ws.weapon.type.toUpperCase()})</small></span>
              ) : (
                <span style={{ color: "var(--warn, #e6a23c)" }}>— {o.noPistolHint}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <strong>{o.kpis}</strong>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
          {(
            [
              [o.dps, fmt(kpis.dps), activeMetrics?.dps],
              [o.chc, `${fmt(kpis.chc, 1)} %${kpis.chc >= 60 ? ` (${o.chcCapHint})` : ""}`, activeMetrics?.chc],
              [o.chd, `${fmt(kpis.chd, 1)} %`, activeMetrics?.chd],
              [o.wd, `${fmt(kpis.wd, 1)} %`, activeMetrics?.wd],
              [o.armor, fmt(kpis.armor), activeMetrics?.armor],
            ] as Array<[string, string, number | undefined]>
          ).map(([label, val, activeV]) => {
            const d = delta(Number(val.replace(/[^\d,-]/g, "").replace(",", ".")), activeV);
            return (
              <div key={label} className="badge" style={{ padding: "6px 10px", display: "grid", gap: 2 }}>
                <span style={{ fontSize: 10, color: "var(--text-dim, #aaa)" }}>{label}</span>
                <span>
                  {val}
                  {d && Math.abs(d.d) > 0.01 && (
                    <small style={{ color: d.up ? "var(--ok, #4caf50)" : "var(--err, #e05252)" }}>
                      {" "}{d.up ? "▲" : "▼"} {fmt(Math.abs(d.d), label === o.dps ? 0 : 1)}
                    </small>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <strong>{o.gear}</strong>
        <table style={{ width: "100%", marginTop: 6, fontSize: 13 }}>
          <tbody>
            {SLOT_ORDER.map((slot) => {
              const g = cand.gear.find((x) => x.slot === slot);
              if (!g) return null;
              const activeHas = active?.gearIds?.[slot] === g.id;
              return (
                <tr key={slot} style={{ opacity: activeHas ? 1 : 0.85 }}>
                  <td style={{ padding: "3px 6px", color: "var(--text-dim, #aaa)" }}>{SLOT_LABEL_DE[slot]}</td>
                  <td style={{ padding: "3px 6px" }}>
                    {g.brand}
                    {!activeHas && active?.gearIds?.[slot] && <small style={{ color: "var(--warn, #e6a23c)" }}> ≠ aktiv</small>}
                  </td>
                  <td style={{ padding: "3px 6px", fontSize: 12 }}>
                    {g.core === "wd" ? `WD ${g.coreValue}` : g.core === "armour" ? `Rüstung ${fmt(g.coreValue)}` : "Skill-Tier"}
                    {" · "}
                    {g.attributes.map((a) => `${a.type} ${a.value}`).join(", ")}
                    {g.talent ? ` · ${g.talent}` : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <strong>{o.why}</strong>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
          <li>{role.name} — Score {fmt(ranked.score, 1)} ({ranked.admissible ? "zulässig" : `${ranked.violationCount} Verstöße`})</li>
          {cand.meetsTargetChc && <li>CHC-Ziel erreicht ({fmt(cand.damage.cappedChc, 1)} %)</li>}
          {cand.gear.some((g) => g.brandType === "gearset") && (
            <li>Set-Teile: {cand.gear.filter((g) => g.brandType === "gearset").map((g) => g.brand).join(", ")}</li>
          )}
        </ul>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`${role.name} — ${cand.weapon.name} (${new Date().toLocaleDateString("de-DE")})`}
          style={{ flex: "1 1 200px" }}
        />
        <button className="btn btn-primary" onClick={() => onSaveLoadout(cand, name)}>{o.saveLoadout}</button>
        <button className="btn" onClick={() => onShare(cand)}>{o.share}</button>
      </div>
    </section>
  );
}

export function saveCandidateAsLoadout(store: ReturnType<typeof useStore>, cand: V4Candidate, name: string, roleKey: string, request: OptimizerRequest): Loadout {
  const role = roleProfile(roleKey);
  const gearIds: Record<string, string> = {};
  for (const g of cand.gear) gearIds[g.slot] = g.id;
  const metric = request.targetMetric === "burst" ? cand.damage.effectiveDps : request.targetMetric === "rotation" ? cand.vector.dps : cand.damage.sustainedDps;
  const modsBySlotLocal = (modsJson as unknown as {
    slots: Record<string, Array<{ name: string; slotTypes: string[]; bonus: { type: string; val: number } | null; penalty?: { type: string; val: number } | null }>>;
  }).slots;
  const weaponMods: WeaponMod[] = cand.weapons
    .filter((ws) => ws.weapon)
    .flatMap((ws) => bestModsForWeapon(ws.weapon!, modsBySlotLocal).map((m: { slot: string; attr: string; value: number; modName: string }) => ({ slot: m.slot as WeaponMod["slot"], attr: m.attr as WeaponMod["attr"], value: m.value, dbName: m.modName })));
  const picks = bestGearModsForRole(roleKey, { chcTarget: role.chcTarget ?? request.targetChc, chcCurrent: cand.stats.chc });
  const bySlot = new Map(picks.map((p) => [p.slot, p]));
  const gearMods: Record<string, { attr: string; value: number }> = {};
  for (const g of cand.gear) {
    const pick = bySlot.get(g.slot);
    if (pick) gearMods[g.id] = { attr: pick.attr, value: pick.val };
  }
  const build: Loadout = {
    id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || `${role.name} — ${cand.weapon.name} (${new Date().toLocaleDateString("de-DE")})`,
    weaponIds: cand.weapons.filter((w) => w.weapon).map((w) => w.weapon!.id),
    gearIds,
    note: `Gespeichert aus dem Optimierer (Rolle: ${role.name})`,
    timestamp: new Date().toISOString(),
    roleId: roleKey,
    assumptions: cand.vector.assumptions.map((a) => a.label),
    metrics: { dps: metric, chc: cand.stats.chc, chd: cand.stats.chd, wd: cand.stats.wd, hsd: cand.stats.hsd, armor: Math.round(cand.vector.ehp) },
    dbVersion: DB_VERSION,
    gearMods: Object.keys(gearMods).length > 0 ? gearMods : undefined,
    weaponMods: weaponMods.length > 0 ? weaponMods : undefined,
    signatures: {
      ...Object.fromEntries(cand.weapons.filter((w) => w.weapon).map((w) => [w.weapon!.id, weaponFingerprint(w.weapon!)])),
      ...Object.fromEntries(cand.gear.map((g) => [g.id, gearFingerprint(g)])),
    },
  };
  store.addBuild(build);
  return build;
}
