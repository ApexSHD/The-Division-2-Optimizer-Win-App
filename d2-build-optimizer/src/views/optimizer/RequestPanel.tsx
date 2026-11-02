import { useMemo, useState } from "react";
import { useStore, type OptimizerRequest } from "../../store";
import { I18nContext } from "../../i18n";
import { useContext } from "react";
import { GOALS, ROLE_PROFILES, roleProfile } from "../../data/roleProfiles";
import { SKILLS, SPECIALIZATIONS } from "../../data/v4Data";
import { DIFFICULTIES, GAME_MODE_DIFFICULTIES, defaultDifficultyFor } from "../../data/difficultyProfiles";
import type { WeaponType } from "../../data/sampleData";
import { computeInventoryCheck } from "./inventoryCheck";

function Section({
  title,
  summary,
  defaultOpen,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <section className="field" style={{ padding: 12 }}>
      <button
        type="button"
        className="btn"
        style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between" }}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <strong>{title}</strong>
        <span style={{ color: "var(--text-dim, #aaa)", fontSize: 12 }}>
          {open ? "▾" : "▸"} {summary}
        </span>
      </button>
      {open && <div style={{ marginTop: 10, display: "grid", gap: 8 }}>{children}</div>}
    </section>
  );
}

export function RequestPanel({ request, onChange }: { request: OptimizerRequest; onChange: (r: OptimizerRequest) => void }) {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const o = t.optimizer;
  const check = useMemo(() => computeInventoryCheck(store.gear, store.weapons), [store.gear, store.weapons]);
  const role = roleProfile(request.roleKey);

  const difficulties = DIFFICULTIES.filter((d) => GAME_MODE_DIFFICULTIES[request.gameMode as keyof typeof GAME_MODE_DIFFICULTIES]?.includes(d.key) ?? true);
  const set = (patch: Partial<OptimizerRequest>) => onChange({ ...request, ...patch });

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <Section
        title={o.sectionGoal}
        defaultOpen
        summary={`${role.name} · ${o.gameModes[request.gameMode]}`}
      >
        <div role="radiogroup" aria-label={o.role} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
          {GOALS.map((g) => (
            <div key={g.key} style={{ gridColumn: "1 / -1", fontSize: 11, color: "var(--text-dim, #aaa)", marginTop: 4 }}>{g.name}</div>
          ))}
          {ROLE_PROFILES.map((r) => {
            const rc = check.roles.find((x) => x.roleKey === r.key);
            return (
              <button
                key={r.key}
                type="button"
                role="radio"
                aria-checked={request.roleKey === r.key}
                className={`btn ${request.roleKey === r.key ? "btn-primary" : ""}`}
                style={{ textAlign: "left", padding: "6px 8px" }}
                onClick={() => set({ roleKey: r.key })}
                title={rc?.reason}
              >
                <div>{r.name}</div>
                <div style={{ fontSize: 10, color: rc?.feasibility === "possible" ? "var(--ok, #4caf50)" : rc?.feasibility === "limited" ? "var(--warn, #e6a23c)" : "var(--err, #e05252)" }}>
                  {rc?.feasibility === "possible" ? `✓ ${o.rolePossible}` : rc?.feasibility === "limited" ? `◐ ${o.roleLimited}` : `✗ ${o.roleImpossible}`}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={o.sectionContext} defaultOpen summary={`${o.gameModes[request.gameMode]} · ${request.difficultyKey} · ${request.teamSize}P`}>
        <label style={{ display: "grid", gap: 4 }}>
          <span>{o.gameMode}</span>
          <select value={request.gameMode} onChange={(e) => set({ gameMode: e.target.value as OptimizerRequest["gameMode"], difficultyKey: defaultDifficultyFor(e.target.value) })}>
            {(Object.keys(o.gameModes) as Array<keyof typeof o.gameModes>).map((k) => (
              <option key={k} value={k}>{o.gameModes[k]}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>{o.difficulty}</span>
          <select value={request.difficultyKey} onChange={(e) => set({ difficultyKey: e.target.value })}>
            {difficulties.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>{o.teamSize}</span>
          <select value={request.teamSize} onChange={(e) => set({ teamSize: Number(e.target.value) as OptimizerRequest["teamSize"] })}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </Section>

      <Section title={o.sectionSkills} summary={request.skills.length > 0 ? request.skills.join(", ") : "—"}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 6 }}>
          {SKILLS.map((s) => {
            const active = request.skills.includes(s.key);
            return (
              <button
                key={s.key}
                type="button"
                className={`btn ${active ? "btn-primary" : ""}`}
                style={{ textAlign: "left", padding: "6px 8px" }}
                aria-pressed={active}
                onClick={() => set({ skills: active ? request.skills.filter((k) => k !== s.key) : [...request.skills, s.key] })}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title={o.sectionRules}
        summary={`${request.lockedGearIds.length} ${o.locked} · ${request.excludedGearIds.length} ${o.excluded}`}
      >
        <div style={{ fontSize: 12, color: "var(--text-dim, #aaa)" }}>
          {o.locked}: {request.lockedGearIds.length} · {o.excluded}: {request.excludedGearIds.length} · {request.excludedWeaponIds.length} {o.weapons}
        </div>
        <label style={{ display: "grid", gap: 4 }}>
          <span>{o.targetGearSet}</span>
          <input value={request.targetGearSet} onChange={(e) => set({ targetGearSet: e.target.value })} placeholder="z. B. Striker's Battlegear" />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>{o.weaponType}</span>
          <select value={request.weaponTypeFilter} onChange={(e) => set({ weaponTypeFilter: e.target.value as WeaponType | "" })}>
            <option value="">—</option>
            {(["ar", "smg", "lmg", "rifle", "mmr", "shotgun", "pistol"] as WeaponType[]).map((t) => (
              <option key={t} value={t}>{t.toUpperCase()}</option>
            ))}
          </select>
        </label>
      </Section>

      <Section title={o.sectionAdvanced} summary={`${o.targetMetric} · CHC ${request.targetChc} · HSD ${request.targetHsd}`}>
        <label style={{ display: "grid", gap: 4 }}>
          <span>{o.targetMetric}</span>
          <select value={request.targetMetric} onChange={(e) => set({ targetMetric: e.target.value as OptimizerRequest["targetMetric"] })}>
            <option value="burst">{o.metricBurst}</option>
            <option value="sustained">{o.metricSustained}</option>
            <option value="rotation">{o.metricRotation}</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>{o.targetChc} (%)</span>
          <input type="number" min={0} max={60} value={request.targetChc} onChange={(e) => set({ targetChc: Number(e.target.value) })} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>{o.targetHsd} (%)</span>
          <input type="number" min={0} value={request.targetHsd} onChange={(e) => set({ targetHsd: Number(e.target.value) })} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>{o.spec} ({o.specFromGlobal}: {store.agent.spec})</span>
          <select value={request.spec} onChange={(e) => set({ spec: e.target.value })}>
            {SPECIALIZATIONS.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
        </label>
      </Section>
    </div>
  );
}
