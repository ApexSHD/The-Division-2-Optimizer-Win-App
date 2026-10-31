import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore, DEFAULT_OPTIMIZATION } from "../store";
import {
  GOALS,
  ROLE_PROFILES,
  roleProfile,
  type ScoredBuild,
} from "../data/roleProfiles";
import {
  optimizeV4,
  bestGearModsForRole,
  type ModeContext,
  type V4BuildResult,
  type V4Candidate,
} from "../data/operatingModes";
import { bestModsForWeapon } from "../data/damage";
import type { WeaponMod } from "../data/sampleData";
import type { GearPiece, GearSlot } from "../data/sampleData";
import type { MinimumViolation } from "../data/roleProfiles";
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
import { DB_VERSION, reloadSecondsFor } from "../data/sampleData";
import { weaponFingerprint, gearFingerprint } from "../data/loadoutIntegrity";
import {
  DIFFICULTIES,
  difficultyInfo,
  timeToKillSeconds,
  allowedDifficulties,
  defaultDifficultyFor,
  prototypeCapActive,
  stackSetHint,
  STACK_SET_NAMES,
  type DifficultyKey,
} from "../data/difficultyProfiles";
import type { WeaponType, Loadout, LoadoutMetrics } from "../data/sampleData";

interface EnemyPreset {
  key: string;
  label: string;
  enemyHeadshotShare: number;
  enemyArmorShare: number;
  enemyHealthShare: number;
  enemyOocShare: number;
  hint: string;
}

// Gegnertyp-Presets: typische Gegner-Mixe (multiplikative Attribute DTA/DTH/DTToOC wirken je Mix unterschiedlich)
const ENEMY_PROFILE_PRESETS: EnemyPreset[] = [
  {
    key: "standard",
    label: "Standard (gemischt)",
    enemyHeadshotShare: 0,
    enemyArmorShare: 80,
    enemyHealthShare: 20,
    enemyOocShare: 70,
    hint: "Bodyshots, gemischte Gegner: ~80 % Rüstungsleiste, ~70 % ungedeckt — DTA und DTToOC wirken.",
  },
  {
    key: "elite",
    label: "Nur Elite",
    enemyHeadshotShare: 0,
    enemyArmorShare: 90,
    enemyHealthShare: 10,
    enemyOocShare: 60,
    hint: "Elite-Gegner (Raids/Legendär): dicke Rüstungsleiste — DTA bringt am meisten, DTToOC etwas weniger (Elites decken sich öfter).",
  },
  {
    key: "named",
    label: "Nur Benannt (Named Bosses)",
    enemyHeadshotShare: 10,
    enemyArmorShare: 95,
    enemyHealthShare: 5,
    enemyOocShare: 50,
    hint: "Named/Bosse: fast nur Rüstungsleiste, decken sich häufig — DTA volle Wirkung, DTToOC geringer.",
  },
  {
    key: "health",
    label: "Nur Lebensenergie (z. B. OG-Builds)",
    enemyHeadshotShare: 20,
    enemyArmorShare: 0,
    enemyHealthShare: 100,
    enemyOocShare: 80,
    hint: "Gegner mit Lebensenergie-Struktur (z. B. OG-Content): DTA bringt nichts, DTH volle Wirkung.",
  },
  {
    key: "kopfschuss",
    label: "Kopfschuss-Fokus",
    enemyHeadshotShare: 40,
    enemyArmorShare: 80,
    enemyHealthShare: 20,
    enemyOocShare: 70,
    hint: "Anteil der Treffer auf den Kopf 40 % — Voraussetzung für DPS-Kopfschuss-Rollen; HSD wirkt auf jeden Kopftreffer.",
  },
  {
    key: "eigen",
    label: "Eigen",
    enemyHeadshotShare: -1,
    enemyArmorShare: -1,
    enemyHealthShare: -1,
    enemyOocShare: -1,
    hint: "Alle Anteile frei einstellbar.",
  },
];

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
  kneepads: "Knieschoner",
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

function violationText(v: MinimumViolation): string {
  const actual =
    v.actual === null || v.actual === undefined
      ? "—"
      : `${v.actual.toLocaleString("de-DE", { maximumFractionDigits: 1 })}${
          v.kind === "headshot_share" || v.kind === "chc" ? " %" : ""
        }`;
  const required =
    v.required === null || v.required === undefined
      ? "—"
      : `${v.required.toLocaleString("de-DE", { maximumFractionDigits: 1 })}${
          v.kind === "headshot_share" || v.kind === "chc" ? " %" : ""
        }`;
  return `${v.label} — ist ${actual}, erforderlich ${required}`;
}

const RARITY_LABELS: Record<string, string> = {
  brand: "High-End",
  gearset: "Gear-Set",
  named: "Named",
  exotic: "Exotic",
};

const CORE_LABELS: Record<string, string> = {
  wd: "Waffenschaden",
  armour: "Rüstung",
  skill: "Skill-Stufe",
};

function SlotTile({
  item,
  changed,
  onToggleLock,
  locked,
  contribution,
}: {
  item: GearPiece | null;
  changed: boolean;
  onToggleLock?: (id: string) => void;
  locked?: boolean;
  contribution?: string;
}) {
  if (!item) {
    return <div className="field" style={{ border: "1px dashed var(--border, #555)", borderRadius: 6, padding: 8, minHeight: 96 }}>—</div>;
  }
  const attrs = item.attributes
    .map((a) => `${GEAR_ATTR_SHORT[a.type] ?? a.type} +${a.value.toLocaleString("de-DE")}`)
    .join(", ");
  return (
    <div
      className="field"
      style={{
        border: `1px solid ${changed ? "var(--ok, #67c23a)" : "var(--border, #555)"}`,
        borderRadius: 6,
        padding: 8,
        minHeight: 96,
        position: "relative",
        background: changed ? "rgba(103,194,58,0.05)" : undefined,
      }}
      title={changed ? "Weicht vom aktuell getragenen Build ab" : undefined}
    >
      <div style={{ fontSize: 11, color: "var(--text-dim, #aaa)" }}>
        {SLOT_LABELS[item.slot] ?? item.slot} {changed && <span title="Weicht vom aktuell getragenen Build ab">≠</span>}
      </div>
      <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>
        {item.brand} <span style={{ fontSize: 10, color: "var(--text-dim, #aaa)" }}>({RARITY_LABELS[item.brandType] ?? item.brandType})</span>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.4 }}>
        {CORE_LABELS[item.core] ?? item.core}
        {item.core !== "skill" && item.coreValue !== undefined
          ? ` +${item.coreValue.toLocaleString("de-DE")}${item.core === "wd" ? " %" : ""}`
          : ""}
      </div>
      {attrs && <div style={{ fontSize: 11, lineHeight: 1.4 }}>{attrs}</div>}
      {item.talent && (
        <div style={{ fontSize: 11, color: "var(--text-dim, #aaa)" }}>
          {item.talent} <span title="Talent fließt nicht in die Berechnung ein (FORMELN.md §8)">— nicht berechnet</span>
        </div>
      )}
      {contribution && (
        <div style={{ fontSize: 10, color: "var(--text-dim, #aaa)" }} title="Vergleich der Kandidaten mit und ohne dieses Teil (Näherung über die Ergebnisliste)">
          Was bringt dieses Teil? {contribution}
        </div>
      )}
      {onToggleLock && (
        <button
          className="btn"
          style={{ fontSize: 10, padding: "2px 8px", marginTop: 4 }}
          onClick={() => onToggleLock(item.id)}
          title={locked ? "Sperre aufheben — Teil darf wieder getauscht werden" : "Teil festlegen — muss in jedem Build verwendet werden"}
        >
          {locked ? "🔓 Sperre aufheben" : "🔒 Muss verwendet werden"}
        </button>
      )}
    </div>
  );
}

function LoadoutCard({
  result,
  cand,
  roleChcTarget,
  roleHsdTarget,
  teamSize,
  gameMode,
  difficultyKey,
}: {
  result: V4BuildResult;
  cand: V4Candidate;
  roleChcTarget: number | null;
  roleHsdTarget: number | null;
  teamSize: number;
  gameMode: string | undefined;
  difficultyKey: string;
}) {
  const store = useStore();
  const active = store.builds.find((b) => b.id === store.activeBuildId) ?? null;
  const activeGearIds = new Set(Object.values(active?.gearIds ?? {}));
  const lockedIds = new Set(store.optimization.lockedGearIds);
  const toggleLock = (id: string) =>
    store.setOptimization({
      ...store.optimization,
      lockedGearIds: lockedIds.has(id)
        ? store.optimization.lockedGearIds.filter((x) => x !== id)
        : [...store.optimization.lockedGearIds, id],
    });
  const bySlot = new Map<GearSlot, GearPiece>(cand.gear.map((g) => [g.slot as GearSlot, g]));
  const metricOf = (c: { damage: { effectiveDps: number; sustainedDps: number } }) =>
    store.optimization.targetMetric === "burst" ? c.damage.effectiveDps : c.damage.sustainedDps;
  const contributions = new Map<string, string>();
  for (const g of cand.gear) {
    const withPart = result.candidates.filter((c) => c.gear.some((x) => x.id === g.id));
    const withoutPart = result.candidates.filter((c) => !c.gear.some((x) => x.id === g.id));
    if (withPart.length === 0 || withoutPart.length === 0) continue;
    const avg = (list: typeof result.candidates) => list.reduce((a, c) => a + metricOf(c), 0) / list.length;
    const delta = ((avg(withPart) - avg(withoutPart)) / avg(withoutPart)) * 100;
    contributions.set(
      g.id,
      `${delta >= 0 ? "+" : ""}${delta.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % DPS (Ø)`,
    );
  }
  const stats = cand.stats;
  const dpsTop = Math.max(
    ...result.ranked.map((b) => result.candidates.find((c) => c.id === b.id)?.damage.effectiveDps ?? 0),
  );
  const dpsValue =
    store.optimization.targetMetric === "burst" ? cand.damage.effectiveDps : cand.damage.sustainedDps;
  const dpsShare = dpsTop > 0 ? (100 * dpsValue) / dpsTop : 100;
  const activeMetrics = active?.metrics ?? null;
  const dpsDeltaActive =
    activeMetrics && activeMetrics.dps > 0
      ? `${(((dpsValue - activeMetrics.dps) / activeMetrics.dps) * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`
      : null;
  const chcCapped = Math.min(60, stats.chc);
  const chcState =
    roleChcTarget === null
      ? "Ziel nicht relevant für diese Rolle"
      : chcCapped + 0.01 >= (roleChcTarget ?? 0)
        ? `Ziel erreicht (${chcCapped.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % ≥ ${roleChcTarget} %)`
        : `Ziel verfehlt (${chcCapped.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % < ${roleChcTarget} %)`;
  const metricLabel = store.optimization.targetMetric === "burst" ? "Burst-DPS" : "Dauer-DPS";
  const sustained = cand.damage.sustainedDps;
  const sustainedDeltaActive =
    activeMetrics && activeMetrics.dps > 0
      ? `${(((sustained - activeMetrics.dps) / activeMetrics.dps) * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`
      : null;
  const metrics: Array<[string, string, string]> = [
    [`${metricLabel} (primär)`, dpsValue.toLocaleString("de-DE", { maximumFractionDigits: 0 }), dpsDeltaActive ? `Δ zu aktiv: ${dpsDeltaActive}` : "Kein aktives Loadout als Referenz"],
    ["Burst-/Dauer-DPS", `${cand.damage.effectiveDps.toLocaleString("de-DE", { maximumFractionDigits: 0 })} / ${sustained.toLocaleString("de-DE", { maximumFractionDigits: 0 })}`, sustainedDeltaActive ? `Δ Dauer zu aktiv: ${sustainedDeltaActive}` : "Burst ohne, Dauer inkl. Nachladen"],
    ["Schaden/Magazin", cand.damage.damagePerMagazine.toLocaleString("de-DE", { maximumFractionDigits: 0 }), `Magazin: ${cand.weapon.magSize} Schuss · Nachladen: ${reloadSecondsFor(cand.weapon).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s`],
    ["Zeit bis leeres Magazin", `${cand.damage.secondsPerMagazine.toLocaleString("de-DE", { maximumFractionDigits: 1 })} s`, ""],
    [
      "Zeit zum Töten (Elite)",
      (() => {
        const dps =
          store.optimization.targetMetric === "burst"
            ? cand.damage.effectiveDps
            : cand.damage.sustainedDps;
        const ttk = timeToKillSeconds(
          store.optimization.difficultyKey as DifficultyKey,
          "elite",
          teamSize as 1 | 2 | 3 | 4,
          dps,
        );
        return ttk === null
          ? "\u2014"
          : `${ttk.toLocaleString("de-DE", { maximumFractionDigits: 1 })} s (Pool ${(
              timeToKillSeconds(store.optimization.difficultyKey as DifficultyKey, "elite", teamSize as 1 | 2 | 3 | 4, 1_000_000) ?? 0
            ).toFixed(1)} Mio.)`;
      })(),
      `${difficultyInfo(store.optimization.difficultyKey as DifficultyKey).label} · ${teamSize} Spieler`,
    ],
    ["Kritische Trefferchance (CHC)", `${chcCapped.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %${stats.chc > 60 ? " (über Cap gedeckelt)" : ""}`, chcState],
    ["Kritischer Trefferschaden (CHD)", `+${stats.chd.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`, `Cap 60 % für CHC beachtet`],
    ["Waffenschaden (WD)", `+${stats.wd.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`, ""],
    [
      "Kopfschussschaden (HSD)",
      `+${stats.hsd.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`,
      roleHsdTarget === null
        ? ""
        : stats.hsd + 0.01 >= roleHsdTarget
          ? `Ziel erreicht (${stats.hsd.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % ≥ ${roleHsdTarget} %)`
          : `Ziel verfehlt (${stats.hsd.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % < ${roleHsdTarget} %)`,
    ],
  ];
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <strong>Wertzusammensetzung nach Quelle</strong>
        {(["wd", "chc", "chd", "hsd"] as const).map((key) => {
          const list = stats.sources[key] ?? [];
          const total = list.reduce((acc, src2) => acc + src2.value, 0);
          if (total <= 0) return null;
          const palette = ["#4f9cf9", "#67c23a", "#e6a23c", "#b07cf9", "#f97f9c", "#7cd0e0", "#c9b458"];
          return (
            <div key={key}>
              <div style={{ fontSize: 11, color: "var(--text-dim, #aaa)", marginBottom: 2 }}>
                {GEAR_ATTR_SHORT[key] ?? key} +{total.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %
              </div>
              <div style={{ display: "flex", height: 10, borderRadius: 4, overflow: "hidden", border: "1px solid var(--border, #555)" }}>
                {list.map((src2, i) => (
                  <div
                    key={i}
                    title={`${src2.label}: +${src2.value.toLocaleString("de-DE")}`}
                    style={{ width: `${(100 * src2.value) / total}%`, background: palette[i % palette.length] }}
                  />
                ))}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-dim, #aaa)", display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                {list.map((src2, i) => (
                  <span key={i}>
                    <span style={{ display: "inline-block", width: 8, height: 8, background: palette[i % palette.length], borderRadius: 2, marginRight: 3 }} />
                    {src2.label} +{src2.value.toLocaleString("de-DE")}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        <small style={{ color: "var(--text-dim, #aaa)" }}>Farbliche Segmente je Quelle; Maus über einem Segment zeigt den Betrag. Gear-Mods: Max-Roll angenommen (siehe Annahmen-Panel).</small>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        {metrics.map(([label, value, hint]) => (
          <div key={label} className="field" style={{ margin: 0, padding: "6px 10px", borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: "var(--text-dim, #aaa)" }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{value}</div>
            {hint && <div style={{ fontSize: 10, color: "var(--text-dim, #aaa)" }}>{hint}</div>}
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-dim, #aaa)", marginBottom: 4 }}>
          DPS-Anteil am besten Ergebnis: {dpsShare.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "var(--border, #555)", overflow: "hidden" }}>
          <div style={{ width: `${Math.max(0, Math.min(100, dpsShare))}%`, height: "100%", background: "var(--accent, #4f9cf9)" }} />
        </div>
      </div>
      <div style={{ fontSize: 12, display: "grid", gap: 2 }}>
        <strong>Set- und Marken-Boni</strong>
        {(() => {
          const stackSets = cand.gear
            .map((g) => g.brand)
            .filter((b) => STACK_SET_NAMES.some((n) => b.toLowerCase().includes(n)));
          const uniqueStackSets = [...new Set(stackSets)];
          const hint = stackSetHint(difficultyKey, uniqueStackSets);
          return hint ? (
            <div
              style={{
                border: "1px solid var(--border, #555)",
                borderRadius: 6,
                padding: "4px 8px",
                fontSize: 12,
                background: "rgba(79,156,249,0.08)",
              }}
            >
              ℹ {hint}
            </div>
          ) : null;
        })()}
        {prototypeCapActive(gameMode) && (
          <div
            style={{
              border: "1px dashed var(--warn, #e6a23c)",
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 12,
              background: "rgba(230,162,60,0.06)",
            }}
          >
            ⚠ <strong>Raid/Incursion — kein Prototyp:</strong> Prototyp-Werte zählen hier nur bis zum
            High-End-Maximalwert (z. B. WD 20 % → 15 %, CHD 17 % → 12 %). Prototyp-Teile im Build:{" "}
            {cand.gear.filter((g) => g.prototype).length + (cand.weapon.isPrototype ? 1 : 0)}
          </div>
        )}
        {(() => {
          const brandCounts = new Map<string, { count: number; label: string }>();
          const greenCounts = new Map<string, { count: number; label: string }>();
          for (const g of cand.gear) {
            const bucket = g.brandType === "gearset" ? greenCounts : g.brandType === "brand" ? brandCounts : null;
            if (!bucket) continue;
            const key = g.brand.toLowerCase().split(" ")[0];
            const e = bucket.get(key) ?? { count: 0, label: g.brand };
            e.count += 1;
            bucket.set(key, e);
          }
          const rows: React.ReactNode[] = [];
          const tiersFor = (map: Map<string, { count: number; label: string }>, isGreen: boolean) => {
            for (const [key, { count, label }] of map) {
              const nextTier = isGreen ? count + 1 : Math.min(3, count + 1);
              const activeTxt = isGreen ? `${count}/4 Teile` : `${count}/3 Marken-Teilen`;
              const nextTxt = count < (isGreen ? 4 : 3) ? ` — ${nextTier - count} weiteres Teil für nächste Stufe` : " — maximale Stufe aktiv";
              rows.push(
                <div key={`${isGreen}-${key}`}>
                  {isGreen ? "🟩" : "🏷"} {label}: {activeTxt}{nextTxt}
                </div>,
              );
            }
          };
          tiersFor(greenCounts, true);
          tiersFor(brandCounts, false);
          if (rows.length === 0) rows.push(<div key="none">Keine Set- oder Marken-Boni aktiv (nur Named/Exotic-Teile).</div>);
          return rows;
        })()}
        <small style={{ color: "var(--text-dim, #aaa)" }}>
          Nicht modellierte Boni (z. B. bestimmte 4er-Set-Effekte, Exotic-Perks) sind mit „nicht berechnet“ im Annahmen-Panel gekennzeichnet — siehe docs/FORMELN.md §8.
        </small>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
        {(["mask", "chest", "holster", "backpack", "gloves", "kneepads"] as const).map((slot) => {
          const item = bySlot.get(slot) ?? null;
          return (
            <SlotTile
              key={slot}
              item={item}
              changed={Boolean(item) && !activeGearIds.has(item!.id)}
              onToggleLock={toggleLock}
              locked={Boolean(item) && lockedIds.has(item!.id)}
              contribution={item ? contributions.get(item.id) : undefined}
            />
          );
        })}
        <SlotTile item={null} changed={false} />
        <div
          className="field"
          style={{ border: "1px solid var(--border, #555)", borderRadius: 6, padding: 8, minHeight: 96, gridColumn: "span 2" }}
        >
          <div style={{ fontSize: 11, color: "var(--text-dim, #aaa)" }}>Waffe 1</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {cand.weapon.name} <span style={{ fontSize: 10, color: "var(--text-dim, #aaa)" }}>({cand.weapon.type.toUpperCase()})</span>
          </div>
          <div style={{ fontSize: 12 }}>
            Grundschaden {cand.weapon.baseDamage.toLocaleString("de-DE")} · {cand.weapon.rpm} RPM
          </div>
          {cand.weapon.talent && (
            <div style={{ fontSize: 11, color: "var(--text-dim, #aaa)" }}>
              {cand.weapon.talent} <span title="Talent fließt nicht in die Berechnung ein (FORMELN.md §8)">— nicht berechnet</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AlternativesList({
  result,
  activeMetrics,
  targetMetric,
}: {
  result: V4BuildResult;
  activeMetrics: LoadoutMetrics | null;
  targetMetric: "burst" | "sustained";
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const rows = result.ranked.map((b) => ({
    scored: b,
    cand: result.candidates.find((c) => c.id === b.id),
  }));
  const metricOf = (c: { damage: { effectiveDps: number; sustainedDps: number } }) =>
    targetMetric === "burst" ? c.damage.effectiveDps : c.damage.sustainedDps;
  const bestDps = Math.max(
    ...rows.map((r) => (r.cand ? metricOf(r.cand) : 0)),
    0,
  );
  const weaponBest = new Map<string, { row: (typeof rows)[number]; rank: number }>();
  for (const row of rows) {
    const wid = row.cand?.weapon.id;
    if (wid && !weaponBest.has(wid)) weaponBest.set(wid, { row, rank: weaponBest.size + 1 });
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <strong>Alternativen</strong>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Rang</th>
            <th style={{ textAlign: "left" }}>Waffe</th>
            <th style={{ textAlign: "left" }}>Schwerpunkt</th>
            <th style={{ textAlign: "right" }}>DPS ({targetMetric === "burst" ? "Burst" : "Dauer"})</th>
            <th style={{ textAlign: "right" }}>Δ zu Rang 1</th>
            {activeMetrics && <th style={{ textAlign: "right" }}>Δ zu aktiv</th>}
            <th style={{ textAlign: "left" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map((r, i) => {
            const dps = r.cand ? metricOf(r.cand) : 0;
            const deltaTop =
              bestDps > 0
                ? `${(((dps - bestDps) / bestDps) * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`
                : "—";
            const deltaActive =
              activeMetrics && activeMetrics.dps > 0
                ? `${(((dps - activeMetrics.dps) / activeMetrics.dps) * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`
                : null;
            const setCount = new Set(
              r.cand?.gear.filter((g) => g.brandType === "gearset").map((g) => g.brand) ?? [],
            );
            const brandCount = new Set(
              r.cand?.gear.filter((g) => g.brandType === "brand").map((g) => g.brand) ?? [],
            );
            const focus = [
              setCount.size > 0 ? `${[...setCount].join("/")}` : null,
              brandCount.size > 0 ? `${brandCount.size} Marke(n)` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <React.Fragment key={r.scored.id}>
                <tr
                  style={{ cursor: "pointer", background: expanded === r.scored.id ? "rgba(79,156,249,0.08)" : undefined }}
                  onClick={() => setExpanded(expanded === r.scored.id ? null : r.scored.id)}
                >
                  <td>{i + 1}</td>
                  <td>{r.cand?.weapon.name ?? "—"}</td>
                  <td style={{ fontSize: 11, color: "var(--text-dim, #aaa)" }}>{focus || "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {dps.toLocaleString("de-DE", { maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{deltaTop}</td>
                  {activeMetrics && (
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{deltaActive ?? "—"}</td>
                  )}
                  <td>
                    {r.scored.admissible
                      ? "✓ Zulässig"
                      : `⚠ Näherung (${r.scored.violationCount} Verletzung(en))`}
                  </td>
                </tr>
                {expanded === r.scored.id && r.cand && (
                  <tr>
                    <td colSpan={activeMetrics ? 7 : 6} style={{ fontSize: 11, color: "var(--text-dim, #aaa)", paddingBottom: 6 }}>
                      {partsLabel(r.cand.gear, r.cand.weapon.name)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 12 }}>
        <strong>Bestes Build je Waffe:</strong>{" "}
        {[...weaponBest.entries()]
          .map(([wid, { row, rank }]) => `${row.cand?.weapon.name ?? wid} (Rang ${rank})`)
          .join(" · ") || "—"}
      </div>
      <small style={{ color: "var(--text-dim, #aaa)" }}>
        Klick auf eine Zeile zeigt die Teile. Ranggröße ist der absolute effektive DPS; der interne
        Score wird nicht mehr angezeigt.
      </small>
    </div>
  );
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
  const [targetSet, setTargetSet] = useState("");
  const [weaponType, setWeaponType] = useState<WeaponType | "">("");
  const [forcedWeaponId, setForcedWeaponId] = useState("");
  const [requireSetChest, setRequireSetChest] = useState(true);
  const [requireSetBackpack, setRequireSetBackpack] = useState(true);
  const [result, setResult] = useState<{
    inventar: V4BuildResult;
    gaps: GapRecommendation[];
    assumptions: EffectVector["assumptions"];
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [loadoutName, setLoadoutName] = useState("");
  const [resultTab, setResultTab] = useState<"ergebnis" | "verbesserungen">("ergebnis");

  const saveActiveBestAsLoadout = () => {
    if (!result || !bestBuild) return;
    const cand = result.inventar.candidates.find((c) => c.id === bestBuild.id);
    if (!cand) return;
    const gearIds: Record<string, string> = {};
    for (const g of cand.gear) gearIds[g.slot] = g.id;
    const name =
      loadoutName.trim() ||
      `${role.name} — ${cand.weapon.name} (${new Date().toLocaleDateString("de-DE")})`;
    const build: Loadout = {
      id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name,
      weaponIds: [cand.weapon.id],
      gearIds,
      note: bestIsApproximation
        ? `Beste Näherung — ${bestViolations.map((v) => v.label).join("; ")}`
        : `Gespeichert aus dem Optimierer (Rolle: ${role.name})`,
      timestamp: new Date().toISOString(),
      roleId: roleKey,
      assumptions: result.assumptions.map((a) => a.label),
      metrics: {
        dps: store.optimization.targetMetric === "burst" ? cand.damage.effectiveDps : cand.damage.sustainedDps,
        chc: cand.stats.chc,
        chd: cand.stats.chd,
        wd: cand.stats.wd,
        hsd: cand.stats.hsd,
        armor: bestBuild.vector.ehp,
      },
      dbVersion: DB_VERSION,
      gearMods: (() => {
        const picks = bestGearModsForRole(roleKey, {
          chcTarget: role.chcTarget ?? undefined,
          chcCurrent: cand.stats.chc,
        });
        const bySlot = new Map(picks.map((p) => [p.slot, p]));
        const out: Record<string, { attr: string; value: number }> = {};
        for (const g of cand.gear) {
          const pick = bySlot.get(g.slot);
          if (pick) out[g.id] = { attr: pick.attr, value: pick.val };
        }
        return Object.keys(out).length > 0 ? out : undefined;
      })(),
      weaponMods: (() => {
        const modsBySlotLocal = (modsJson as unknown as {
          slots: Record<string, Array<{ name: string; slotTypes: string[]; bonus: { type: string; val: number } | null; penalty?: { type: string; val: number } | null }>>;
        }).slots;
        const auto = bestModsForWeapon(cand.weapon, modsBySlotLocal);
        return auto.length > 0
          ? auto.map((m) => ({
              slot: m.slot as WeaponMod["slot"],
              attr: m.attr as WeaponMod["attr"],
              value: m.value,
              dbName: m.modName,
            }))
          : undefined;
      })(),
      signatures: {
        [cand.weapon.id]: weaponFingerprint(cand.weapon),
        ...Object.fromEntries(cand.gear.map((g) => [g.id, gearFingerprint(g)])),
      },
    };
    store.addBuild(build);
    store.setActiveBuildId(build.id);
    setLoadoutName("");
  };

  const goal = GOALS.find((g) => g.key === goalKey) ?? GOALS[0];
  const role = roleProfile(roleKey);
  const damageRole = goalKey === "dps" || goalKey === "hybrid";
  const questions = useMemo(() => questionsForRole(roleKey), [roleKey]);
  const answeredCount = useMemo(
    () => questions.filter((q) => answers.some((a) => a.questionKey === q.key)).length,
    [questions, answers],
  );
  const effectiveWeights = expertMode && expertWeights ? expertWeights : weightsFromAnswers(roleKey, answers);
  const gameModeAnswer = answers.find((a) => a.questionKey === "gameMode")?.optionKey;
  const visibleDifficulties = useMemo(
    () => DIFFICULTIES.filter((d) => allowedDifficulties(gameModeAnswer).includes(d.key)),
    [gameModeAnswer],
  );
  const difficultyValid = useMemo(
    () => visibleDifficulties.some((d) => d.key === store.optimization.difficultyKey),
    [visibleDifficulties, store.optimization.difficultyKey],
  );
  useEffect(() => {
    if (!difficultyValid) {
      store.setOptimization({
        ...store.optimization,
        difficultyKey: defaultDifficultyFor(gameModeAnswer),
      });
    }
  }, [difficultyValid, gameModeAnswer]);

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
  const needsHeadshotShare = role.minima.some((m) => m.kind === "headshot_share");
  const headshotShareMissing = needsHeadshotShare && store.optimization.enemyHeadshotShare <= 0;
  const setEnemyHeadshotShare = (v: number) =>
    store.setOptimization({ ...store.optimization, enemyHeadshotShare: v });
  const selectedPreset =
    ENEMY_PROFILE_PRESETS.find(
      (p) =>
        p.enemyHeadshotShare >= 0 &&
        p.enemyHeadshotShare === store.optimization.enemyHeadshotShare &&
        p.enemyArmorShare === store.optimization.enemyArmorShare &&
        p.enemyHealthShare === store.optimization.enemyHealthShare &&
        p.enemyOocShare === store.optimization.enemyOocShare,
    ) ?? ENEMY_PROFILE_PRESETS[ENEMY_PROFILE_PRESETS.length - 1];
  const selectPreset = (presetKey: string) => {
    const preset = ENEMY_PROFILE_PRESETS.find((p) => p.key === presetKey);
    if (!preset || preset.enemyHeadshotShare < 0) return;
    store.setOptimization({
      ...store.optimization,
      enemyHeadshotShare: preset.enemyHeadshotShare,
      enemyArmorShare: preset.enemyArmorShare,
      enemyHealthShare: preset.enemyHealthShare,
      enemyOocShare: preset.enemyOocShare,
    });
  };

  const runGenerationRef = useRef(0);
  const cancelOptimization = () => {
    runGenerationRef.current += 1;
    setRunning(false);
  };

  const runOptimization = () => {
    if (store.weapons.length === 0 || store.gear.length === 0) return;
    const generation = ++runGenerationRef.current;
    setRunning(true);
    setTimeout(() => {
      if (generation !== runGenerationRef.current) return;
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
      const gaps = analyzeGaps({
        weapons: store.weapons,
        inventarGear: store.gear,
        fullGear: store.gear,
        ctx,
      });
      const bestVector = (inventar.best ?? inventar.ranked[0])?.vector;
      if (generation !== runGenerationRef.current) return;
      setResult({
        inventar,
        gaps: gaps.recommendations,
        assumptions: bestVector ? bestVector.assumptions : [],
      });
      setRunning(false);
    }, 30);
  };

  const bestBuild: ScoredBuild | null = result?.inventar.best ?? result?.inventar.ranked[0] ?? null;
  const bestIsApproximation = Boolean(result && !result.inventar.best && result.inventar.ranked.length > 0);
  const bestViolations: MinimumViolation[] = bestBuild?.violations ?? [];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="field">
        <h2 style={{ margin: 0 }}>Build-Optimierung V4</h2>
        <p style={{ margin: 0, color: "var(--text-dim, #aaa)" }}>
{"Rolle wählen, optional Rahmen anpassen, am Ende „Builds berechnen“"}
        </p>
      </section>

      <section className="field" style={{ display: "grid", gap: 6 }}>
        <strong>Inventar-Status</strong>
        {(() => {
          const slots = (["mask", "chest", "holster", "backpack", "gloves", "kneepads"] as const).map((slot) => ({
            slot,
            count: store.gear.filter((g) => g.slot === slot).length,
            cores: {
              rot: store.gear.filter((g) => g.slot === slot && g.core === "wd").length,
              blau: store.gear.filter((g) => g.slot === slot && g.core === "armour").length,
              gelb: store.gear.filter((g) => g.slot === slot && g.core === "skill").length,
            },
          }));
          const coreCount = (core: "wd" | "armour" | "skill") =>
            store.gear.filter((g) => g.core === core).length;
          const feasible = (requirements: Partial<{ wd: number; armour: number; skill: number }>) =>
            (requirements.wd ?? 0) <= coreCount("wd") &&
            (requirements.armour ?? 0) <= coreCount("armour") &&
            (requirements.skill ?? 0) <= coreCount("skill");
          const roleHints = ROLE_PROFILES.map((r) => {
            const needs = r.minima
              .filter((m): m is { kind: "core_distribution"; wd: number; skill?: number; armour?: number } => m.kind === "core_distribution")
              .map((m) => ({ wd: m.wd ?? 0, armour: m.armour ?? 0, skill: m.skill ?? 0 }));
            const ok = needs.length === 0 || needs.some((n) => feasible(n));
            return { name: r.name, ok };
          });
          return (
            <div style={{ fontSize: 12, display: "grid", gap: 4 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {slots.map((s) => (
                  <span key={s.slot}>
                    {SLOT_LABELS[s.slot]}: {s.count}{" "}
                    <span style={{ color: "var(--text-dim, #aaa)" }}>
                      (🔴 {s.cores.rot} · 🔵 {s.cores.blau} · 🟡 {s.cores.gelb})
                    </span>
                  </span>
                ))}
                <span>Waffen: {store.weapons.length}</span>
              </div>
              <div>
                Rollen mit diesem Inventar möglich:{" "}
                {roleHints.filter((r) => r.ok).map((r) => r.name).join(", ") || "— (Kernverteilung zu einseitig)"}
                {roleHints.some((r) => !r.ok) && (
                  <span style={{ color: "var(--text-dim, #aaa)" }}>
                    {" "}
                    — nicht möglich: {roleHints.filter((r) => !r.ok).map((r) => r.name).join(", ")} (siehe Verbesserungen-Tab nach der Berechnung)
                  </span>
                )}
              </div>
            </div>
          );
        })()}
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

      <details className="field" style={{ display: "grid", gap: 10 }}>
        <summary style={{ cursor: "pointer" }}>
          <strong>
            Fragebogen (optional, {answeredCount}/{questions.length} beantwortet) — Antworten bleiben beim Rollenwechsel erhalten
          </strong>
        </summary>
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
            Teamgröße (steuert auch die Gegner-Teamskalierung)
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
      </details>

      <section className="field" style={{ display: "grid", gap: 10 }}>
        <strong>Rahmen — Gegnerprofil & CHC-Ziel (früher „Global“)</strong>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            Gegnerprofil
            <select value={selectedPreset.key} onChange={(e) => selectPreset(e.target.value)}>
              {ENEMY_PROFILE_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            Kopfschuss-Anteil
            <input
              type="number"
              min={0}
              max={100}
              value={store.optimization.enemyHeadshotShare}
              onChange={(e) => setEnemyHeadshotShare(Math.max(0, Math.min(100, Number(e.target.value))))}
              style={{ width: 64, textAlign: "center" }}
            />
            <span style={{ fontSize: 12, color: "var(--text-dim, #aaa)" }}>%</span>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            Schwierigkeit
            <select
              value={store.optimization.difficultyKey}
              onChange={(e) =>
                store.setOptimization({
                  ...store.optimization,
                  difficultyKey: e.target.value,
                })
              }
            >
              {visibleDifficulties.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            Zielmetrik
            <select
              value={store.optimization.targetMetric}
              onChange={(e) =>
                store.setOptimization({
                  ...store.optimization,
                  targetMetric: e.target.value as "burst" | "sustained",
                })
              }
            >
              <option value="sustained">Dauer-DPS (inkl. Nachladen)</option>
              <option value="burst">Burst-DPS (ohne Nachladen)</option>
            </select>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            CHC-Zielwert
            <input
              type="number"
              min={10}
              max={60}
              value={store.optimization.targetChc}
              onChange={(e) =>
                store.setOptimization({
                  ...store.optimization,
                  targetChc: Math.max(10, Math.min(60, Number(e.target.value))),
                })}
              style={{ width: 64, textAlign: "center" }}
            />
            <span style={{ fontSize: 12, color: "var(--text-dim, #aaa)" }}>%</span>
          </label>
          {needsHeadshotShare && (
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              HSD-Zielwert
              <input
                type="number"
                min={0}
                max={300}
                value={store.optimization.targetHsd}
                onChange={(e) =>
                  store.setOptimization({
                    ...store.optimization,
                    targetHsd: Math.max(0, Math.min(300, Number(e.target.value))),
                  })
                }
                style={{ width: 64, textAlign: "center" }}
              />
              <span style={{ fontSize: 12, color: "var(--text-dim, #aaa)" }}>%</span>
            </label>
          )}
        </div>
        <small style={{ color: "var(--text-dim, #aaa)" }}>
          {selectedPreset.hint} Alle Werte wirken direkt auf die nächste Berechnung. Charakterdaten (SHD, Spezialisierung) bleiben in „Global“.
        </small>
        {(store.optimization.lockedGearIds.length > 0 || store.optimization.anchorWeaponId) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 12 }}>
            <span style={{ color: "var(--text-dim, #aaa)" }}>Aktive Sperren:</span>
            {store.optimization.anchorWeaponId && (
              <span className="tag" style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border, #555)" }}>
                🔫 Waffe: {store.weapons.find((w) => w.id === store.optimization.anchorWeaponId)?.name ?? "?"}
              </span>
            )}
            {store.optimization.lockedGearIds.map((id) => (
              <span key={id} className="tag" style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border, #555)" }}>
                🔒 {(() => {
                  const g = store.gear.find((x) => x.id === id);
                  return g ? `${g.brand} (${SLOT_LABELS[g.slot] ?? g.slot})` : id;
                })()}
              </span>
            ))}
            <button
              className="btn"
              style={{ fontSize: 11, padding: "2px 8px" }}
              onClick={() =>
                store.setOptimization({
                  ...store.optimization,
                  lockedGearIds: [],
                  anchorWeaponId: "",
                })
              }
            >
              Alle Sperren aufheben
            </button>
          </div>
        )}
        {headshotShareMissing && (
          <div style={{ border: "1px solid var(--warn, #e6a23c)", borderRadius: 6, padding: "6px 10px", background: "rgba(230,162,60,0.08)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span>
              <strong>Voraussetzung der Rolle {role.name} nicht erfüllt:</strong> Der Kopfschuss-Anteil
              im Gegnerprofil muss über 0 % liegen, sonst ist kein zulässiges Build möglich.
            </span>
            <button className="btn" onClick={() => setEnemyHeadshotShare(40)}>
              Kopfschuss-Anteil auf 40 % setzen
            </button>
          </div>
        )}
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
        <button className="btn btn-primary" onClick={runOptimization} disabled={running || store.gear.length === 0 || store.weapons.length === 0}>
          {running ? "Berechne…" : "Builds berechnen"}
        </button>
        {running && (
          <button className="btn" onClick={cancelOptimization}>
            Abbrechen
          </button>
        )}
        {store.weapons.length === 0 && (
          <span style={{ color: "var(--warn, #e6a23c)" }}>
            Noch keine Waffen erfasst — bitte zuerst Waffen importieren (Ansicht „Waffen“, CSV-Import).
          </span>
        )}
        {store.gear.length === 0 && (
          <span style={{ color: "var(--warn, #e6a23c)" }}>
            Noch keine Gear-Teile erfasst — bitte zuerst Gear importieren (Ansicht „Gear“, CSV-Import).
          </span>
        )}
      </section>

      {result && (
        <>
          <div className="tabs" style={{ display: "flex", gap: 6 }}>
            <button
              className={`btn ${resultTab === "ergebnis" ? "btn-primary" : ""}`}
              onClick={() => setResultTab("ergebnis")}
            >
              Ergebnis
            </button>
            <button
              className={`btn ${resultTab === "verbesserungen" ? "btn-primary" : ""}`}
              onClick={() => setResultTab("verbesserungen")}
            >
              Verbesserungen ({result.gaps.length})
            </button>
          </div>
          {resultTab === "ergebnis" && (
          <section className="field" style={{ display: "grid", gap: 10 }}>
            <strong>Ergebnis — Inventar-Build</strong>
            <div
              style={{
                border: "1px dashed var(--warn, #e6a23c)",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 12,
                background: "rgba(230,162,60,0.06)",
              }}
            >
              ⚠ <strong>Nicht modelliert:</strong> Waffen-/Gear-Talente, Exotic-Perks und
              Stack-Effekte fließen nicht in die Berechnung ein. Details: Dokumentation
              „docs/FORMELN.md“, Abschnitt 8 („Bewusst nicht abgebildet“). Betroffene Teile sind
              in den Kacheln mit „nicht berechnet“ gekennzeichnet.
            </div>
            {bestIsApproximation && (
              <div style={{ border: "1px solid var(--warn, #e6a23c)", borderRadius: 6, padding: "6px 10px", background: "rgba(230,162,60,0.08)" }}>
                <strong>Kein zulässiges Build — Beste Näherung:</strong> Dieses Build verletzt die
                Mindestanforderungen der Rolle. Details siehe unten („Nicht erfüllte Anforderungen").
                Behebungsvorschläge finden sich in der Lückenanalyse.
              </div>
            )}
            {result.inventar.noAdmissibleHint && !bestIsApproximation && (
              <div style={{ color: "var(--warn, #e6a23c)" }}>{result.inventar.noAdmissibleHint}</div>
            )}
            {result.inventar.skillHint && (
              <div style={{ color: "var(--warn, #e6a23c)" }}>{result.inventar.skillHint}</div>
            )}
            {bestViolations.length > 0 && (
              <details style={{ border: "1px solid var(--warn, #e6a23c)", borderRadius: 6, padding: "6px 10px" }}>
                <summary style={{ cursor: "pointer", color: "var(--warn, #e6a23c)" }}>
                  <strong>Nicht erfüllte Anforderungen ({bestViolations.length})</strong>
                </summary>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
                  {bestViolations.map((v, i) => (
                    <li key={`${v.kind}-${i}`}>
                      {violationText(v)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
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
            {bestBuild && (() => {
              const cand = result.inventar.candidates.find((c) => c.id === bestBuild.id);
              if (!cand) return null;
              return (
                <LoadoutCard
                  result={result.inventar}
                  cand={cand}
                  roleChcTarget={role.chcTarget}
                  roleHsdTarget={needsHeadshotShare ? store.optimization.targetHsd : null}
                  teamSize={teamSize}
                  gameMode={gameModeAnswer}
                  difficultyKey={store.optimization.difficultyKey}
                />
              );
            })()}
            {bestBuild && (() => {
              const cand = result.inventar.candidates.find((c) => c.id === bestBuild.id);
              if (!cand) return null;
              return (
                <div style={{ fontSize: 13 }}>
                  <strong>Warum dieses Build?</strong>{" "}
                  {AXES.filter((a) => bestBuild.normalized[a] > 0)
                    .map(
                      (a) =>
                        `${AXIS_LABELS[a]} ${bestBuild.normalized[a].toFixed(0)} %`,
                    )
                    .join(" · ")}
                </div>
              );
            })()}
            {bestBuild && (() => {
              const cand = result.inventar.candidates.find((c) => c.id === bestBuild.id);
              if (!cand) return null;
              return (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                  <input
                    type="text"
                    placeholder="Loadout-Name (Vorschlag: Rolle — Waffe — Datum)"
                    value={loadoutName}
                    onChange={(e) => setLoadoutName(e.target.value)}
                    style={{ flex: "1 1 240px" }}
                  />
                  <button className="btn" onClick={saveActiveBestAsLoadout}>
                    💾 Als Loadout speichern
                  </button>
                </div>
              );
            })()}
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
                ["Waffenschaden (WD) gesamt", `${stats.wd.toFixed(1)} %`],
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
            <AlternativesList result={result.inventar} activeMetrics={store.builds.find((b) => b.id === store.activeBuildId)?.metrics ?? null} targetMetric={store.optimization.targetMetric} />
          </section>
          )}

          {resultTab === "verbesserungen" && (
          <>
          <section className="field" style={{ display: "grid", gap: 8 }}>
            <strong>Verbesserungen — Empfehlungen nach erwartetem Gewinn</strong>
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
        </>
      )}
    </div>
  );
}
