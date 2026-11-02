import type { AxisKey } from "./v4Data";
import { roleProfile } from "./roleProfiles";

/**
 * CR-02 OP-2.10: 3 Spielstil-Fragen statt des 10-Fragen-Fragebogens.
 * Jede Antwort verschiebt die Rollengewichte sichtbar (Vorschau in der UI).
 */
export interface PlayStyleOption {
  key: string;
  labelDe: string;
  labelEn: string;
  weightShift: Partial<Record<AxisKey, number>>;
  /** Zielmetrik-Vorschlag, den die Antwort impliziert (UI-Hinweis). */
  metricHint?: "burst" | "sustained" | "rotation";
}

export interface PlayStyleQuestion {
  key: string;
  labelDe: string;
  labelEn: string;
  options: PlayStyleOption[];
}

export const PLAY_STYLE_QUESTIONS: PlayStyleQuestion[] = [
  {
    key: "playStyle",
    labelDe: "Wie spielst du bevorzugt?",
    labelEn: "How do you prefer to play?",
    options: [
      { key: "aggressive", labelDe: "Aggressiv, viel in Bewegung", labelEn: "Aggressive, mobile", weightShift: { ehp: 0.1 } },
      { key: "cover", labelDe: "Aus der Deckung, gezielt", labelEn: "From cover, precise", weightShift: { dps: 0.1, cc: -0.05 } },
      { key: "mixed", labelDe: "Gemischt", labelEn: "Mixed", weightShift: {} },
    ],
  },
  {
    key: "reloadBehavior",
    labelDe: "Bei leerem Magazin: Nachladen oder Waffe wechseln?",
    labelEn: "Empty magazine: reload or swap weapons?",
    options: [
      { key: "reload", labelDe: "Nachladen (Dauer-DPS zählt)", labelEn: "Reload (sustained DPS matters)", weightShift: {}, metricHint: "sustained" },
      { key: "swap", labelDe: "Waffe wechseln (Burst/Rotation zählt)", labelEn: "Swap weapons (burst/rotation matters)", weightShift: {}, metricHint: "rotation" },
    ],
  },
  {
    key: "buildPriority",
    labelDe: "Build-Priorität?",
    labelEn: "Build priority?",
    options: [
      { key: "damage", labelDe: "Maximaler Schaden", labelEn: "Maximum damage", weightShift: { dps: 0.1, ehp: -0.1 } },
      { key: "balanced", labelDe: "Ausgeglichen", labelEn: "Balanced", weightShift: {} },
      { key: "survival", labelDe: "Überleben vor Schaden", labelEn: "Survival first", weightShift: { ehp: 0.15, dps: -0.05 } },
    ],
  },
];

export interface PlayStyleAnswers {
  playStyle?: string;
  reloadBehavior?: string;
  buildPriority?: string;
}

/** Gewichte aus Rolle + Spielstil-Antworten (sichtbar in der Vorschau). */
export function weightsWithPlayStyle(roleKey: string, answers: PlayStyleAnswers): Record<AxisKey, number> {
  const role = roleProfile(roleKey);
  const base: Record<AxisKey, number> = { ...role.weights };
  for (const q of PLAY_STYLE_QUESTIONS) {
    const opt = q.options.find((o) => o.key === answers[q.key as keyof PlayStyleAnswers]);
    if (!opt) continue;
    for (const [axis, shift] of Object.entries(opt.weightShift) as Array<[AxisKey, number]>) {
      base[axis] = Math.max(0, Number((base[axis] + shift).toFixed(2)));
    }
  }
  return base;
}

/** Zielmetrik-Vorschlag aus den Antworten (reloadBehavior=swap -> rotation). */
export function metricHintFromAnswers(answers: PlayStyleAnswers): "burst" | "sustained" | "rotation" | null {
  for (const q of PLAY_STYLE_QUESTIONS) {
    const opt = q.options.find((o) => o.key === answers[q.key as keyof PlayStyleAnswers]);
    if (opt?.metricHint) return opt.metricHint;
  }
  return null;
}
