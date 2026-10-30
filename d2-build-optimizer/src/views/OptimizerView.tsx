import { useMemo, useState } from "react";
import { useStore, DEFAULT_OPTIMIZATION } from "../store";
import {
  GOALS,
  ROLE_PROFILES,
  roleProfile,
  type ScoredBuild,
} from "../data/roleProfiles";
import {
  optimizeV4,
  reachability,
  bestGearModsForRole,
  type ModeContext,
  type V4BuildResult,
} from "../data/operatingModes";
import { analyzeGaps, GAP_STAGE_C_NOTE, type GapRecommendation } from "../data/gapAnalysis";
import {
  questionsForRole,
  weightsFromAnswers,
  suggestSpecialization,
  type QuestionnaireAnswer,
  type AxisWeights,
} from "../data/questionnaire";
import { SKILLS, AXES } from "../data/v4Data";
import gearJson from "../db/gear.json";
import modsJson from "../db/mod.json";
import type { WeaponType } from "../data/sampleData";

const GEARSET_NAMES: string[] = Object.values(
  (gearJson as unknown as { green_set_info: Record<string, { name?: string }> }).green_set_info,
)
  .map((info) => info.name)
  .filter((n): n is string => Boolean(n))
  .sort((a, b) => a.localeCompare(b));

const WEAPON_TYPES: Array<{ value: WeaponType | ""; label: string }> = [
  { value: "", label: "Alle" },
  { value: "ar", label: "Sturmgewehr (AR)" },
  { value: "smg", label: "Maschinenpistole (SMG)" },
  { value: "lmg", label: "LMG" },
  { value: "rifle", label: "Gewehr" },
  { value: "mmr", label: "Präzisionsgewehr (MMR)" },
  { value: "shotgun", label: "Schrotflinte" },
  { value: "pistol", label: "Pistole" },
];
import type { SkillChoice, EffectVector } from "../data/axes";
import type { AxisKey } from "../data/v4Data";
const SLOT_LABELS: Record<string, string> = {
  mask: "Maske",
  chest: "Weste",
  holster: "Holster",
  backpack: "Rucksack",
  gloves: "Handschuhe",
  kneepads: "Kniekehlen",
};

const GEAR_ATTR_SHORT: Record<string, string> = {
  chc: "CHC",
  chd: "CHD",
  hsd: "HSD",
  wd: "WD",
  dta: "DTA",
  dth: "DTH",
  dttooc: "DTtoOC",
  wh: "Handling",
  armorregen: "Rüst.Reg.",
  explres: "Expl.Res.",
  hazard: "Gefahrensch.",
  health: "HP",
  skilldmg: "Skill-Sch.",
  skillhaste: "Skill-Eile",
  repair: "Reparatur",
  status: "Status",
  aok: "AoK",
  rof: "Feuerrate",
  incomrepair: "Eingeh. Rep.",
};

function partsLabel(
  gear: Array<{
    brand: string;
    slot: string;
    core?: string;
    coreValue?: number;
    attributes?: Array<{ type: string; value: number }>;
  }>,
  weaponName?: string,
): string {
  const bySlotOrder = ["mask", "chest", "holster", "backpack", "gloves", "kneepads"];
  const sorted = [...gear].sort(
    (a, b) => bySlotOrder.indexOf(a.slot) - bySlotOrder.indexOf(b.slot),
  );
  const parts = sorted.map((g) => {
    const attrs = (g.attributes ?? [])
      .map((a) => `${GEAR_ATTR_SHORT[a.type] ?? a.type} ${a.value.toLocaleString("de-DE")}`)
      .join(", ");
    const core =
      g.core === "wd"
        ? `WD ${g.coreValue?.toLocaleString("de-DE")}`
        : g.core === "armour"
          ? `Rüstung ${g.coreValue?.toLocaleString("de-DE")}`
          : g.core === "skill"
            ? `Skill-Stufe`
            : "";
    return `${g.brand} (${SLOT_LABELS[g.slot] ?? g.slot})${core ? ` · ${core}` : ""}${attrs ? ` · ${attrs}` : ""}`;
  });
  if (weaponName) parts.push(`Waffe: ${weaponName}`);
  return parts.join(" | ");
}

const AXIS_LABELS: Record<AxisKey, string> = {
  dps: "Eigener Schaden",
  skl: "Skill-Wirkung",
  ehp: "Überlebensfähigkeit",
  cc: "Kontrolle",
  buf: "Team-Buff",
  upt: "Verfügbarkeit",
};

function RadarChart({ normalized }: { normalized: Record<AxisKey, number> }) {
  const size = 160;
  const center = size / 2;
  const radius = center - 18;
  const angle = (i: number) => (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
  const point = (i: number, value: number) => {
    const r = (Math.max(0, Math.min(100, value)) / 100) * radius;
    return [center + r * Math.cos(angle(i)), center + r * Math.sin(angle(i))];
  };
  const points = AXES.map((axis, i) => point(i, normalized[axis]).join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Netzdiagramm der sechs Achsen">
      {[25, 50, 75, 100].map((ring) => (
        <polygon
          key={ring}
          points={AXES.map((_, i) => point(i, ring).join(",")).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1}
        />
      ))}
      {AXES.map((axis, i) => {
        const [x, y] = point(i, 100);
        const [lx, ly] = point(i, 118);
        return (
          <g key={axis}>
            <line x1={center} y1={center} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} />
            <text x={lx} y={ly} fontSize={9} textAnchor="middle" dominantBaseline="middle">
              {AXIS_LABELS[axis]}
            </text>
          </g>
        );
      })}
      <polygon points={points} fill="currentColor" fillOpacity={0.25} stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

function reachabilityPercentText(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(1)} %`;
}

function valueText(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)} k`;
  return v.toFixed(2);
}

export function OptimizerView() {
  const store = useStore();
  const [goalKey, setGoalKey] = useState<string>(GOALS[0].key);
  const [roleKey, setRoleKey] = useState<string>(ROLE_PROFILES[0].key);
  const [expertMode, setExpertMode] = useState(false);
  const [answers, setAnswers] = useState<QuestionnaireAnswer[]>([]);
  const [expertWeights, setExpertWeights] = useState<AxisWeights | null>(null);
  const [teamSize, setTeamSize] = useState(4);
  const [skillKeys, setSkillKeys] = useState<string[]>(["hive/restorer"]);
  const [mode, setMode] = useState<"inventar" | "ziel">("inventar");
  const [targetSet, setTargetSet] = useState("");
  const [weaponType, setWeaponType] = useState<WeaponType | "">("");
  const [forcedWeaponId, setForcedWeaponId] = useState("");
  const [requireSetChest, setRequireSetChest] = useState(true);
  const [requireSetBackpack, setRequireSetBackpack] = useState(true);
  const [result, setResult] = useState<{
    inventar: V4BuildResult;
    ziel: V4BuildResult;
    reach: ReturnType<typeof reachability>;
    gaps: GapRecommendation[];
    assumptions: EffectVector["assumptions"];
  } | null>(null);
  const [running, setRunning] = useState(false);

  const goal = GOALS.find((g) => g.key === goalKey) ?? GOALS[0];
  const role = roleProfile(roleKey);
  const damageRole = goalKey === "dps" || goalKey === "hybrid";
  const questions = useMemo(() => questionsForRole(roleKey), [roleKey]);
  const answeredCount = useMemo(
    () => questions.filter((q) => answers.some((a) => a.questionKey === q.key)).length,
    [questions, answers],
  );
  const effectiveWeights = expertMode && expertWeights ? expertWeights : weightsFromAnswers(roleKey, answers);

  const allSkills = useMemo(
    () => SKILLS.flatMap((s) => s.variants.map((v) => ({ skill: s, variant: v }))),
    [],
  );
  const selectedSkills: SkillChoice[] = useMemo(
    () =>
      skillKeys
        .map((key) => allSkills.find((c) => `${c.skill.key}/${c.variant.key}` === key))
        .filter((c): c is SkillChoice => Boolean(c)),
    [skillKeys, allSkills],
  );
  const specSuggestion = useMemo(
    () => suggestSpecialization(roleKey, effectiveWeights, teamSize, selectedSkills),
    [roleKey, effectiveWeights, teamSize, selectedSkills],
  );

  const runOptimization = () => {
    if (store.weapons.length === 0 || store.gear.length === 0) return;
    setRunning(true);
    setTimeout(() => {
      const ctx: ModeContext = {
        mode: "inventar",
        roleKey,
        skills: selectedSkills,
        teamSize,
        shdLevel: store.agent.shdLevel,
        settings: {
          ...DEFAULT_OPTIMIZATION,
          ...store.optimization,
          weaponTypeFilter: damageRole ? weaponType : "",
          targetGearSet: targetSet,
          anchorWeaponId: forcedWeaponId,
        },
        gearSetOptions: {
          targetSet: targetSet || undefined,
          requireSetChest,
          requireSetBackpack,
        },
        threatStatusShare: 0.3,
        spec: specSuggestion.best.key,
      };
      const modsBySlot = (modsJson as unknown as {
        slots: Record<string, Array<{ name: string; slotTypes: string[]; bonus: { type: string; val: number } | null; penalty?: { type: string; val: number } | null }>>;
      }).slots;
      const opts = { modsBySlot };
      const inventar = optimizeV4(store.weapons, store.gear, { ...ctx, mode: "inventar" }, opts);
      const ziel = optimizeV4(store.weapons, store.gear, { ...ctx, mode: "ziel" }, opts);
      const reach = reachability(inventar, ziel);
      const gaps = analyzeGaps({
        weapons: store.weapons,
        inventarGear: store.gear,
        fullGear: store.gear,
        ctx,
      });
      const bestVector = inventar.best?.vector;
      setResult({
        inventar,
        ziel,
        reach,
        gaps: gaps.recommendations,
        assumptions: bestVector ? bestVector.assumptions : [],
      });
      setRunning(false);
    }, 30);
  };

  const bestBuild: ScoredBuild | null = result?.inventar.best ?? null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="field">
        <h2 style={{ margin: 0 }}>Build-Optimierung V4</h2>
        <p style={{ margin: 0, color: "var(--text-dim, #aaa)" }}>
{"Ziel wählen, Fragebogen beantworten, beste Builds berechnen"}
        </p>
      </section>

      <section className="field" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {GOALS.map((g) => (
            <button
              key={g.key}
              className={`btn ${goalKey === g.key ? "btn-primary" : ""}`}
              onClick={() => {
                setGoalKey(g.key);
                const first = ROLE_PROFILES.find((r) => r.ziel === g.key);
                if (first) setRoleKey(first.key);
                setAnswers([]);
              }}
            >
              {g.name}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {goal.roles.map((rk) => {
            const r = roleProfile(rk);
            return (
              <button
                key={rk}
                className={`btn ${roleKey === rk ? "btn-primary" : ""}`}
                onClick={() => {
                  setRoleKey(rk);
                  setAnswers([]);
                  setExpertWeights(null);
                }}
              >
                {r.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="field" style={{ display: "grid", gap: 6 }}>
        <strong>Auswahl</strong>
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
          <span className="tag" style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border, #555)" }}>
            🎯 Ziel: {goal.name}
          </span>{" "}
          <span className="tag" style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border, #555)" }}>
            👤 Rolle: {roleProfile(roleKey).name}
          </span>{" "}
          {expertMode && (
            <span className="tag" style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border, #555)" }}>
              🛠 Expertenmodus
            </span>
          )}{" "}
          <span className="tag" style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border, #555)" }}>
            🤝 Team: {teamSize}
          </span>
          {targetSet && (
            <span className="tag" style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border, #555)" }}>
              🧩 Gearset: {targetSet}
              {requireSetChest ? " · Weste ✓" : ""}
              {requireSetBackpack ? " · Rucksack ✓" : ""}
            </span>
          )}
          {damageRole && weaponType && (
            <span className="tag" style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border, #555)" }}>
              🔫 {WEAPON_TYPES.find((w) => w.value === weaponType)?.label}
            </span>
          )}
          {selectedSkills.length > 0 && (
            <span className="tag" style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border, #555)" }}>
              ⚡ {selectedSkills.map((c) => `${c.skill.name} (${c.variant.name})`).join(", ")}
            </span>
          )}
          <span className="tag" style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border, #555)" }}>
            🎖 Spec-Vorschlag: {specSuggestion.best.name}
          </span>
        </div>
      </section>

      <section className="field" style={{ display: "grid", gap: 10 }}>
        <strong>
          Fragebogen ({answeredCount}/{questions.length} beantwortet)
        </strong>
        {questions.map((q) => {
          const answer = answers.find((a) => a.questionKey === q.key);
          return (
            <div key={q.key} style={{ display: "grid", gap: 4 }}>
              <label style={{ fontWeight: answer ? 600 : 400 }}>
                {q.labelDe}
                {answer && <span style={{ color: "var(--ok, #67c23a)", marginLeft: 6 }}>✓</span>}
              </label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {q.options.map((o) => (
                  <button
                    key={o.key}
                    className={`btn ${answer?.optionKey === o.key ? "btn-primary" : ""}`}
                    style={{ fontSize: 12 }}
                    onClick={() =>
                      setAnswers((prev) => [
                        ...prev.filter((a) => a.questionKey !== q.key),
                        { questionKey: q.key, optionKey: o.key },
                      ])
                    }
                  >
                    {o.labelDe}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={expertMode} onChange={(e) => setExpertMode(e.target.checked)} />
          Expertenmodus (Gewichte direkt ändern)
        </label>
        {expertMode && (
          <div style={{ display: "grid", gap: 6 }}>
            {AXES.map((axis) => (
              <label key={axis} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ width: 140 }}>{AXIS_LABELS[axis]}</span>
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.1}
                  value={expertWeights ? expertWeights[axis] : effectiveWeights[axis]}
                  onChange={(e) =>
                    setExpertWeights((prev) => ({
                      ...(prev ?? effectiveWeights),
                      [axis]: Number(e.target.value),
                    }))
                  }
                />
                <span style={{ width: 36, textAlign: "right" }}>
                  {(expertWeights ? expertWeights[axis] : effectiveWeights[axis]).toFixed(1)}
                </span>
              </label>
            ))}
            <small>Standard: keine Toleranz — individuelle Abweichungen nur über den Expertenmodus (Lastenheft 3.3).</small>
          </div>
        )}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            Teamgröße
            <select value={teamSize} onChange={(e) => setTeamSize(Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            Skills (2 Plätze)
            <select
              multiple
              value={skillKeys}
              onChange={(e) =>
                setSkillKeys(Array.from(e.target.selectedOptions).map((o) => o.value).slice(0, 2))
              }
              style={{ minWidth: 220, minHeight: 64 }}
            >
              {allSkills.map((c) => (
                <option key={`${c.skill.key}/${c.variant.key}`} value={`${c.skill.key}/${c.variant.key}`}>
                  {c.skill.name} — {c.variant.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="field" style={{ display: "grid", gap: 8 }}>
        <strong>Spezialisierungs-Vorschlag (Ergebnis, kein Eingabefeld)</strong>
        <div>
          🥇 <strong>{specSuggestion.best.name}</strong> — {specSuggestion.best.reason}
        </div>
        <div style={{ color: "var(--text-dim, #aaa)", fontSize: 13 }}>
          🥈 {specSuggestion.second.name} (Abstand {(specSuggestion.best.score - specSuggestion.second.score).toFixed(2)})
        </div>
        <small style={{ color: "var(--text-dim, #aaa)" }}>
          Hinweis: Eine Spezialisierung braucht eigene Stufen in der eigenen Fertigkeitenleiste. Der Vorschlag kann
          übernommen oder durch eine feste Wahl ersetzt werden.
        </small>
      </section>

      <section className="field" style={{ display: "grid", gap: 10 }}>
        <strong>Einschränkungen (optional)</strong>
        {store.weapons.length > 0 && (
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            Waffe erzwingen
            <select value={forcedWeaponId} onChange={(e) => setForcedWeaponId(e.target.value)}>
              <option value="">Automatisch (beste Waffe)</option>
              {store.weapons.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.type.toUpperCase()})
                </option>
              ))}
            </select>
          </label>
        )}
        {damageRole && (
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            Waffengattung
            <select value={weaponType} onChange={(e) => setWeaponType(e.target.value as WeaponType | "")}>
              {WEAPON_TYPES.map((wt) => (
                <option key={wt.value} value={wt.value}>
                  {wt.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {!damageRole && (
          <small style={{ color: "var(--text-dim, #aaa)" }}>
            Waffengattung nur bei Schadens-Zielen (DPS/Hybrid) — bei Skill-Builds ist das Waffentalent relevanter.
          </small>
        )}
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          Gearset (optional)
          <select value={targetSet} onChange={(e) => setTargetSet(e.target.value)}>
            <option value="">Keins / automatisch</option>
            {GEARSET_NAMES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {targetSet && (
          <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={requireSetChest}
                onChange={(e) => setRequireSetChest(e.target.checked)}
              />
              Set-Weste erzwingen
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={requireSetBackpack}
                onChange={(e) => setRequireSetBackpack(e.target.checked)}
              />
              Set-Rucksack erzwingen
            </label>
          </div>
        )}
      </section>

      <section className="field" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={runOptimization} disabled={running || store.gear.length === 0}>
          {running ? "Berechne…" : "Builds berechnen"}
        </button>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          Betriebsart
          <select value={mode} onChange={(e) => setMode(e.target.value as "inventar" | "ziel")}>
            <option value="inventar">Inventar-Build</option>
            <option value="ziel">Ziel-Build</option>
          </select>
        </label>
        {store.gear.length === 0 && (
          <span style={{ color: "var(--warn, #e6a23c)" }}>
            Kein Inventar erfasst — bitte zuerst Gear anlegen.
          </span>
        )}
      </section>

      {result && (
        <>
          <section className="field" style={{ display: "grid", gap: 10 }}>
            <strong>Ergebnis — {mode === "inventar" ? "Inventar-Build" : "Ziel-Build"}</strong>
            {result.inventar.noAdmissibleHint && (
              <div style={{ color: "var(--warn, #e6a23c)" }}>{result.inventar.noAdmissibleHint}</div>
            )}
            {result.inventar.skillHint && (
              <div style={{ color: "var(--warn, #e6a23c)" }}>{result.inventar.skillHint}</div>
            )}
            <div>
              Erreichungsgrad (Inventar / Ziel):{" "}
              <strong>{reachabilityPercentText(result.reach.reachabilityPercent)}</strong>
            </div>
            {bestBuild && (
              <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                <RadarChart normalized={bestBuild.normalized} />
                <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  {AXES.map((axis) => (
                    <div key={axis} style={{ display: "flex", gap: 8 }}>
                      <span style={{ width: 140 }}>{AXIS_LABELS[axis]}</span>
                      <span>{bestBuild.normalized[axis].toFixed(1)}</span>
                      <span style={{ color: "var(--text-dim, #aaa)" }}>
                        ({valueText(bestBuild.vector[axis])})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {bestBuild && (
              <div style={{ fontSize: 13 }}>
                {(() => {
                  const cand = result.inventar.candidates.find((c) => c.id === bestBuild.id);
                  return cand ? (
                    <div style={{ marginBottom: 6 }}>
                      <strong>Teile:</strong> {partsLabel(cand.gear, cand.weapon.name)}
                    </div>
                  ) : null;
                })()}
                <strong>Begründung:</strong>{" "}
                {AXES.filter((a) => bestBuild.normalized[a] > 0)
                  .map(
                    (a) =>
                      `${AXIS_LABELS[a]} ${bestBuild.normalized[a].toFixed(0)} %`,
                  )
                  .join(" · ")}
              </div>
            )}
            {bestBuild && (() => {
              const cand = result.inventar.candidates.find((c) => c.id === bestBuild.id);
              if (!cand) return null;
              const stats = cand.stats;
              const gearMods = bestGearModsForRole(roleKey, {
                chcTarget: role.chcTarget ?? undefined,
                chcCurrent: cand.stats.chc,
              });
              const gearModText = gearMods
                .map((m) => `${SLOT_LABELS[m.slot] ?? m.slot}: ${GEAR_ATTR_SHORT[m.attr] ?? m.attr} +${m.val}`)
                .join(", ");
              const summaryRows: Array<[string, string]> = [
                ["Waffe", `${cand.weapon.name} (${cand.weapon.type.toUpperCase()})${cand.weapon.talent ? ` · Talent: ${cand.weapon.talent}` : ""}`],
                ["Gear-Mods (Maske/Weste/Rucksack)", gearModText || "—"],
                ["Waffenschaden (WD) gesamt", `${stats.totalWd.toFixed(1)} %`],
                ["Kritische Trefferchance (CHC)", `${Math.min(60, stats.chc).toFixed(1)} %${stats.chc > 60 ? " (über Cap gedeckelt)" : ""}`],
                ["Kritischer Trefferschaden (CHD)", `${stats.chd.toFixed(1)} %`],
                ["Kopfschussschaden (HSD)", `${stats.hsd.toFixed(1)} %`],
                ["Rüstungsschaden (DTA)", `${stats.dta.toFixed(1)} %`],
                ["Lebenspunktschaden (DTH)", `${stats.dth.toFixed(1)} %`],
                ["Schaden gg. ungedeckte Ziele", `${stats.dttooc.toFixed(1)} %`],
                ["Effektiver DPS", Math.round(cand.damage.effectiveDps).toLocaleString("de-DE")],
              ];
              const provenance: Array<[string, string, number]> = [];
              for (const [attrKey, list] of Object.entries(stats.sources)) {
                for (const src of list) {
                  provenance.push([attrKey, src.label, src.value]);
                }
              }
              return (
                <>
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer" }}>
                      <strong>Übersicht: relevante Werte (Best-Build)</strong>
                    </summary>
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                      <tbody>
                        {summaryRows.map(([label, value]) => (
                          <tr key={label}>
                            <td style={{ padding: "2px 8px 2px 0" }}>{label}</td>
                            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ cursor: "pointer" }}>
                      <strong>Herkunft der Werte (wie im Spiel nachvollziehbar)</strong>
                    </summary>
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>Wert</th>
                          <th style={{ textAlign: "left" }}>Quelle</th>
                          <th style={{ textAlign: "right" }}>Betrag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {provenance.map(([attr, label, value], i) => (
                          <tr key={`${attr}-${i}`}>
                            <td style={{ padding: "1px 8px 1px 0" }}>
                              {GEAR_ATTR_SHORT[attr] ?? attr}
                            </td>
                            <td>{label}</td>
                            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                              {value.toLocaleString("de-DE")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </>
              );
            })()}
            <details>
              <summary style={{ cursor: "pointer" }}>Top-Builds ({result.inventar.ranked.length})</summary>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Score</th>
                    <th>Zulässig</th>
                    <th>Teile</th>
                  </tr>
                </thead>
                <tbody>
                  {result.inventar.ranked.slice(0, 10).map((b, i) => {
                    const cand = result.inventar.candidates.find((c) => c.id === b.id);
                    return (
                      <tr key={b.id}>
                        <td>{i + 1}</td>
                        <td>{b.score.toFixed(1)}</td>
                        <td>{b.admissible ? "✓" : `✗ (${b.violationCount})`}</td>
                        <td style={{ fontSize: 11, color: "var(--text-dim, #aaa)" }}>
                          {cand ? partsLabel(cand.gear, cand.weapon.name) : b.id}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
          </section>

          <section className="field" style={{ display: "grid", gap: 8 }}>
            <strong>Lückenanalyse — Top-3-Empfehlungen</strong>
            {result.gaps.length === 0 && <div>Keine Abweichungen — dein Inventar enthält bereits das Optimum.</div>}
            {result.gaps.map((g) => (
              <div key={`${g.slot}-${g.rank}`} style={{ fontSize: 13 }}>
                <strong>Stufe {g.stage}:</strong> {g.description}{" "}
                <span style={{ color: "var(--text-dim, #aaa)" }}>
                  (Bezugsquelle: {g.source.item} — {g.source.game_activity.join(", ")})
                </span>
              </div>
            ))}
            <small style={{ color: "var(--text-dim, #aaa)" }}>{GAP_STAGE_C_NOTE}</small>
          </section>

          <section className="field" style={{ display: "grid", gap: 6 }}>
            <strong>Annahmen-Panel</strong>
            {result.assumptions.length === 0 && <div>Keine Annahmen aktiv — alle Werte bestätigt.</div>}
            {result.assumptions.map((a) => (
              <div key={a.key} style={{ fontSize: 12 }}>
                • <strong>{a.label}</strong>: {a.value} <span style={{ color: "var(--text-dim, #aaa)" }}>({a.source})</span>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
