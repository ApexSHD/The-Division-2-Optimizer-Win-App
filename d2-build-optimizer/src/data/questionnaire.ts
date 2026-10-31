import { ROLE_PROFILES, GOALS, roleProfile, type RoleProfile } from "./roleProfiles";
import { SPECIALIZATIONS, type AxisKey } from "./v4Data";
import type { SkillChoice } from "./axes";

export interface QuestionOption {
  key: string;
  labelDe: string;
  labelEn: string;
  weightShift: Partial<Record<AxisKey, number>>;
  extra?: { kind: "reviver" | "buff" | "survival" | "skillPriority"; value: number };
}

export interface Question {
  key: string;
  labelDe: string;
  labelEn: string;
  roles: string[];
  options: QuestionOption[];
}

const COMMON_QUESTIONS: Question[] = [
  {
    key: "gameMode",
    labelDe: "Wofür ist der Build gedacht? (Spielmodus/Content)",
    labelEn: "What is the build for? (game mode/content)",
    roles: ROLE_PROFILES.map((r) => r.key),
    options: [
      { key: "openworld", labelDe: "Offene Welt", labelEn: "Open world", weightShift: {} },
      { key: "missions", labelDe: "Missionen", labelEn: "Missions", weightShift: {} },
      { key: "countdown", labelDe: "Vergeltung", labelEn: "Countdown", weightShift: {} },
      { key: "raid", labelDe: "Raid", labelEn: "Raid", weightShift: { ehp: 0.05 } },
      { key: "incursion", labelDe: "Incursion", labelEn: "Incursion", weightShift: { ehp: 0.05 } },
      { key: "pvp", labelDe: "Dark Zone / PvP", labelEn: "Dark Zone / PvP", weightShift: {} },
    ],
  },
  {
    key: "playStyle",
    labelDe: "Wie spielst du dich bevorzugt?",
    labelEn: "How do you prefer to play?",
    roles: ROLE_PROFILES.map((r) => r.key),
    options: [
      { key: "aggressive", labelDe: "Aggressiv, viel in Bewegung", labelEn: "Aggressive, mobile", weightShift: { ehp: 0.1 } },
      { key: "cover", labelDe: "Deckungs-Shooter, gezielt", labelEn: "Cover shooter, precise", weightShift: { dps: 0.05, cc: -0.05 } },
      { key: "mixed", labelDe: "Gemischt", labelEn: "Mixed", weightShift: {} },
    ],
  },
  {
    key: "reloadBehavior",
    labelDe: "Bei leerem Magazin: Nachladen oder Waffe wechseln?",
    labelEn: "Empty magazine: reload or swap weapons?",
    roles: ROLE_PROFILES.filter((r) => r.ziel === "dps").map((r) => r.key),
    options: [
      { key: "reload", labelDe: "Nachladen (Dauer-DPS zählt)", labelEn: "Reload (sustained DPS matters)", weightShift: {} },
      { key: "swap", labelDe: "Waffe wechseln (Burst zählt)", labelEn: "Swap weapons (burst matters)", weightShift: {} },
    ],
  },
  {
    key: "buildPriority",
    labelDe: "Build-Priorität?",
    labelEn: "Build priority?",
    roles: ROLE_PROFILES.map((r) => r.key),
    options: [
      { key: "damage", labelDe: "Maximaler Schaden", labelEn: "Maximum damage", weightShift: { dps: 0.1, ehp: -0.1 } },
      { key: "balanced", labelDe: "Ausgeglichen", labelEn: "Balanced", weightShift: {} },
      { key: "survival", labelDe: "Überleben vor Schaden", labelEn: "Survival first", weightShift: { ehp: 0.15, dps: -0.05 } },
    ],
  },
];

const ROLE_SPECIFIC: Record<string, Question[]> = {
  dps_krit: [
    {
      key: "playStyle",
      labelDe: "Wie spielst du dich bevorzugt?",
      labelEn: "How do you prefer to play?",
      roles: ["dps_krit", "dps_kopf"],
      options: [
        { key: "aggressive", labelDe: "Aggressiv, viel in Bewegung", labelEn: "Aggressive, mobile", weightShift: { ehp: 0.1 } },
        { key: "cover", labelDe: "Aus der Deckung, gezielt", labelEn: "From cover, precise", weightShift: { dps: 0.1 } },
        { key: "mixed", labelDe: "Gemischt", labelEn: "Mixed", weightShift: {} },
      ],
    },
    {
      key: "hsShare",
      labelDe: "Wie hoch ist dein Kopfschuss-Anteil?",
      labelEn: "What is your headshot ratio?",
      roles: ["dps_krit", "dps_kopf"],
      options: [
        { key: "low", labelDe: "Selten (< 20 %)", labelEn: "Rarely (< 20%)", weightShift: {} },
        { key: "mid", labelDe: "Gelegentlich (20–40 %)", labelEn: "Sometimes (20–40%)", weightShift: {} },
        { key: "high", labelDe: "Oft (> 40 %)", labelEn: "Often (> 40%)", weightShift: { dps: 0.1 } },
      ],
    },
  ],
  dps_kopf: [
    {
      key: "playStyle",
      labelDe: "Wie spielst du dich bevorzugt?",
      labelEn: "How do you prefer to play?",
      roles: ["dps_krit", "dps_kopf"],
      options: [
        { key: "aggressive", labelDe: "Aggressiv, viel in Bewegung", labelEn: "Aggressive, mobile", weightShift: { ehp: 0.1 } },
        { key: "cover", labelDe: "Aus der Deckung, gezielt", labelEn: "From cover, precise", weightShift: { dps: 0.1 } },
        { key: "mixed", labelDe: "Gemischt", labelEn: "Mixed", weightShift: {} },
      ],
    },
    {
      key: "hsShareKopf",
      labelDe: "Kopfschuss-Anteil (verbindlich für die Rolle)",
      labelEn: "Headshot ratio (mandatory for this role)",
      roles: ["dps_kopf"],
      options: [
        { key: "high", labelDe: "Überwiegend Kopfschüsse", labelEn: "Mostly headshots", weightShift: { dps: 0.1 } },
        { key: "mixed", labelDe: "Gemischt", labelEn: "Mixed", weightShift: {} },
      ],
    },
  ],
  skill_heiler: [
    {
      key: "healWindow",
      labelDe: "Wie heilst du lieber?",
      labelEn: "How do you prefer to heal?",
      roles: ["skill_heiler"],
      options: [
        { key: "sustain", labelDe: "Dauerhaft (Hive)", labelEn: "Sustained (hive)", weightShift: { upt: 0.1 } },
        { key: "burst", labelDe: "Gezielt/Burst (Heilwerfer)", labelEn: "Targeted/burst", weightShift: { skl: 0.1 } },
      ],
    },
    {
      key: "reviver",
      labelDe: "Ist Wiederbelebung Pflicht?",
      labelEn: "Is reviving mandatory?",
      roles: ["skill_heiler", "ruestungs_supporter", "buffer", "tank"],
      options: [
        { key: "yes", labelDe: "Ja (Reviver-Hive/Plate)", labelEn: "Yes", weightShift: {} , extra: { kind: "reviver", value: 1 } },
        { key: "no", labelDe: "Nein", labelEn: "No", weightShift: {} },
      ],
    },
    {
      key: "healVsDps",
      labelDe: "Heilung gegen eigene Schadenstoleranz?",
      labelEn: "Healing versus own damage?",
      roles: ["skill_heiler"],
      options: [
        { key: "heal", labelDe: "Heilung vor Schaden", labelEn: "Healing first", weightShift: { dps: -0.1, skl: 0.1 } },
        { key: "both", labelDe: "Ausgeglichen", labelEn: "Balanced", weightShift: {} },
      ],
    },
  ],
  kontrolle: [
    {
      key: "ccEffect",
      labelDe: "Welche Effekte bevorzugst du?",
      labelEn: "Which effects do you prefer?",
      roles: ["kontrolle"],
      options: [
        { key: "hard", labelDe: "Festsetzen/Schock (hart)", labelEn: "Foam/shock (hard)", weightShift: { cc: 0.1 } },
        { key: "soft", labelDe: "Blenden/Brand (weich)", labelEn: "Blind/burn (soft)", weightShift: {} },
      ],
    },
    {
      key: "ccUptimeGoal",
      labelDe: "Wie hoch soll die CC-Uptime sein?",
      labelEn: "What CC uptime do you aim for?",
      roles: ["kontrolle"],
      options: [
        { key: "max", labelDe: "Maximal (> 80 %)", labelEn: "Maximum (> 80%)", weightShift: { cc: 0.2, upt: 0.1 } },
        { key: "mid", labelDe: "Mittel (~50 %)", labelEn: "Medium (~50%)", weightShift: {} },
      ],
    },
  ],
  ruestungs_supporter: [
    {
      key: "regenVsArmor",
      labelDe: "Regeneration oder Rohrüstung?",
      labelEn: "Regeneration or raw armor?",
      roles: ["ruestungs_supporter", "tank"],
      options: [
        { key: "regen", labelDe: "Regeneration", labelEn: "Regeneration", weightShift: {} },
        { key: "raw", labelDe: "Rohrüstung", labelEn: "Raw armor", weightShift: {} },
      ],
    },
    {
      key: "kits",
      labelDe: "Nutzt du Rüstungskits aktiv?",
      labelEn: "Do you actively use armor kits?",
      roles: ["ruestungs_supporter", "tank"],
      options: [
        { key: "yes", labelDe: "Ja, häufig", labelEn: "Yes, often", weightShift: {} },
        { key: "no", labelDe: "Selten", labelEn: "Rarely", weightShift: {} },
      ],
    },
    {
      key: "teamArmor",
      labelDe: "Team-Rüstung (Bonusrüstung) aktiv?",
      labelEn: "Team armor (bonus armor) active?",
      roles: ["ruestungs_supporter"],
      options: [
        { key: "yes", labelDe: "Ja, Bonusrüstung fürs Team", labelEn: "Yes", weightShift: { buf: 0.1 } },
        { key: "no", labelDe: "Nein", labelEn: "No", weightShift: { buf: -0.1 } },
      ],
    },
    {
      key: "threat",
      labelDe: "Wie ist dein Bedrohungsprofil?",
      labelEn: "What is your threat profile?",
      roles: ["ruestungs_supporter", "tank"],
      options: [
        { key: "front", labelDe: "Vorne, viel Aggro", labelEn: "Frontline, much aggro", weightShift: { ehp: 0.1 } },
        { key: "back", labelDe: "Hinten, wenig Aggro", labelEn: "Backline", weightShift: {} },
      ],
    },
  ],
  tank: [
    {
      key: "aggroRole",
      labelDe: "Übernimmst du die Aggro-Rolle?",
      labelEn: "Do you take the aggro role?",
      roles: ["tank"],
      options: [
        { key: "yes", labelDe: "Ja, Schild/Köder", labelEn: "Yes, shield/decoy", weightShift: { ehp: 0.1 } },
        { key: "no", labelDe: "Nein, eher passiv", labelEn: "No, rather passive", weightShift: {} },
      ],
    },
  ],
  buffer: [
    {
      key: "buffKind",
      labelDe: "Welche Buff-Art?",
      labelEn: "Which buff type?",
      roles: ["buffer"],
      options: [
        { key: "dmg", labelDe: "Team-Schaden", labelEn: "Team damage", weightShift: { buf: 0.1 } },
        { key: "prot", labelDe: "Team-Schutz", labelEn: "Team protection", weightShift: { buf: 0.1, ehp: 0.1 } },
      ],
    },
    {
      key: "activeTime",
      labelDe: "Wie aktiv bist du mit Buffs?",
      labelEn: "How active are you with buffs?",
      roles: ["buffer"],
      options: [
        { key: "always", labelDe: "Permanenz", labelEn: "Constantly", weightShift: { buf: 0.1 } },
        { key: "sometimes", labelDe: "Gelegentlich", labelEn: "Sometimes", weightShift: {} },
      ],
    },
  ],
  hybrid_all: [
    {
      key: "hybridType",
      labelDe: "Welcher Hybrid-Typ?",
      labelEn: "Which hybrid type?",
      roles: ["hybrid_schaden_skill", "hybrid_schaden_tank", "hybrid_skill_tank"],
      options: [
        { key: "dmgSkill", labelDe: "Schaden/Skill", labelEn: "Damage/skill", weightShift: {} },
        { key: "dmgTank", labelDe: "Schaden/Tank", labelEn: "Damage/tank", weightShift: {} },
        { key: "skillTank", labelDe: "Skill/Tank", labelEn: "Skill/tank", weightShift: {} },
      ],
    },
    {
      key: "hybridDist",
      labelDe: "Verteilung 3/3 oder 4/2?",
      labelEn: "Distribution 3/3 or 4/2?",
      roles: ["hybrid_schaden_skill", "hybrid_schaden_tank", "hybrid_skill_tank"],
      options: [
        { key: "33", labelDe: "3/3", labelEn: "3/3", weightShift: {} },
        { key: "42", labelDe: "4/2 (Variante)", labelEn: "4/2 (variant)", weightShift: {} },
      ],
    },
    {
      key: "hybridFocus",
      labelDe: "Gewichtung der beiden Schwerpunkte?",
      labelEn: "Weighting of the two focuses?",
      roles: ["hybrid_schaden_skill", "hybrid_schaden_tank", "hybrid_skill_tank"],
      options: [
        { key: "first", labelDe: "Erster Schwerpunkt stärker", labelEn: "First focus stronger", weightShift: {} },
        { key: "equal", labelDe: "Gleichwertig", labelEn: "Equal", weightShift: {} },
      ],
    },
  ],
};

export function questionsForRole(roleKey: string): Question[] {
  const role = roleProfile(roleKey);
  const specific: Question[] = [
    ...(ROLE_SPECIFIC[roleKey] ?? []),
    ...(ROLE_SPECIFIC.hybrid_all ?? []).filter((q) => q.roles.includes(roleKey)),
  ];
  const common = COMMON_QUESTIONS.filter((q) => q.roles.includes(role.key));
  const all = [...specific, ...common];
  if (all.length > 10) {
    const keep = new Set([...specific.map((q) => q.key)]);
    for (const q of common) {
      if (all.length - [...keep].length >= 10) break;
      keep.add(q.key);
    }
    return all.filter((q) => keep.has(q.key)).slice(0, 10);
  }
  return all;
}

export interface QuestionnaireAnswer {
  questionKey: string;
  optionKey: string;
}

export interface QuestionnaireResult {
  roleKey: string;
  weights: Record<AxisKey, number>;
  answers: QuestionnaireAnswer[];
}

export function weightsFromAnswers(
  roleKey: string,
  answers: QuestionnaireAnswer[],
): Record<AxisKey, number> {
  const role = roleProfile(roleKey);
  const base = { ...role.weights };
  const questions = questionsForRole(roleKey);
  const answerMap = new Map(answers.map((a) => [a.questionKey, a.optionKey]));
  for (const q of questions) {
    const chosenKey = answerMap.get(q.key);
    const chosen = q.options.find((o) => o.key === chosenKey);
    if (!chosen) continue;
    for (const [axis, shift] of Object.entries(chosen.weightShift) as Array<[AxisKey, number]>) {
      base[axis] = Math.max(0, Number((base[axis] + shift).toFixed(2)));
    }
  }
  return base;
}

export type AxisWeights = Record<AxisKey, number>;
export { GOALS, ROLE_PROFILES };
export type { RoleProfile, SkillChoice };

export interface SpecSuggestion {
  key: string;
  name: string;
  reason: string;
  score: number;
}

export function suggestSpecialization(
  _roleKey: string,
  weights: Record<AxisKey, number>,
  teamSize: number,
  skills: SkillChoice[],
): { best: SpecSuggestion; second: SpecSuggestion; all: SpecSuggestion[] } {
  const scored = SPECIALIZATIONS.map((spec) => {
    let score = 0;
    const reasons: string[] = [];
    for (const axis of ["dps", "skl", "ehp", "cc", "buf", "upt"] as AxisKey[]) {
      const relevance = spec.axis_relevance[axis];
      if (!relevance) continue;
      score += weights[axis] * relevance;
    }
    for (const buff of spec.team_buffs) {
      if (buff.wert === null) continue;
      const factor = buff.target === "team" ? teamSize : buff.target === "team_ohne_mich" ? Math.max(0, teamSize - 1) : 1;
      if (factor <= 0) continue;
      const uptime = buff.uptime ?? 1;
      const magnitude = buff.wert * uptime * factor;
      if (magnitude > 0) {
        score += magnitude / 20;
        reasons.push(`+${buff.wert} % ${buff.wirkung} (Uptime ${(uptime * 100).toFixed(0)} %)`);
      }
    }
    const technicianBonus = spec.skill_boni.find((b) => b.wirkung === "Skill-Stufe");
    if (technicianBonus && technicianBonus.wert !== null && (weights.skl > 0 || weights.upt > 0)) {
      score += technicianBonus.wert * 2 * Math.max(weights.skl, weights.upt);
      reasons.push(`+1 Fertigkeitenrang`);
    }
    if (skills.length > 0 && spec.focus.includes("Skill-Builds")) {
      score += 0.5;
    }
    return {
      key: spec.key,
      name: spec.name,
      reason: reasons.join(", ") || `Achsen-Relevanz für ${spec.focus.join("/")}`,
      score: Number(score.toFixed(3)),
    };
  });
  scored.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  return { best: scored[0], second: scored[1], all: scored };
}

export function goalFor(roleKey: string): string {
  const role = roleProfile(roleKey);
  return GOALS.find((g) => g.key === role.ziel)?.name ?? GOALS[0].name;
}
