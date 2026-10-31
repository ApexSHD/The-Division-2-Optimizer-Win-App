/**
 * Schwierigkeitsgrad-Systematik (Issue #136 / Optimierer-Feinschliff).
 *
 * Datenquellen:
 * - Gegner-HP (Ruestung+Leben gesamt, in Mio.) je Schwierigkeitsgrad, Gegnerrang und
 *   Teamgroesse: Vorgabe des Auftraggebers (31.10.2026, gegen Spielstand zu verifizieren).
 * - Eskalationsstufen 0-10 (Gegnerschaden/LE/Ruestung in % der Heroic-Basis):
 *   Community-Daten (skycoach.gg Escalation Guide, Y8S2), bestaetigt durch Auftraggeber-Vorgabe
 *   (Stufe 10: Schaden +550%, LE/Ruestung +800%).
 *
 * Team-Skalierung: aus der Vorgabe-Tabelle laesst sich ein Faktor von x1,2 pro zusaetzlichem
 * Spieler ableiten (z. B. Heroic Boss: 27,0 / 32,4 / 38,9 / 46,7 Mio) - fuer alle Ringe
 * und Schwierigkeitsgrade konsistent.
 */

export type DifficultyKey =
  | "story"
  | "normal"
  | "hard"
  | "challenging"
  | "heroic"
  | "legendary"
  | "escalation0"
  | "escalation1"
  | "escalation2"
  | "escalation3"
  | "escalation4"
  | "escalation5"
  | "escalation6"
  | "escalation7"
  | "escalation8"
  | "escalation9"
  | "escalation10";

export type EnemyRank = "red" | "veteran" | "elite" | "named";

/** Basis-HP (Ruestung + Leben, Mio.) solo aus der Auftraggeber-Tabelle. */
type BaseDifficulty = "normal" | "hard" | "challenging" | "heroic" | "legendary";
const SOLO_POOL_M: Record<BaseDifficulty, Record<EnemyRank, number>> = {
  normal: { red: 0.55, veteran: 1.2, elite: 2.5, named: 5.57 },
  hard: { red: 0.9, veteran: 2.1, elite: 4.3, named: 9.5 },
  challenging: { red: 1.5, veteran: 3.5, elite: 7.2, named: 16.0 },
  heroic: { red: 3.0, veteran: 6.0, elite: 11.0, named: 27.0 },
  legendary: { red: 5.37, veteran: 14.8, elite: 25.2, named: 40.0 },
};

/** Team-Skalierungsfaktor (x1,2 pro zusaetzlichem Spieler, aus Vorgabe-Tabelle abgeleitet). */
const TEAM_FACTOR: Record<1 | 2 | 3 | 4, number> = { 1: 1.0, 2: 1.2, 3: 1.44, 4: 1.728 };

/** Eskalations-Skalierung relativ zur Heroic-Basis (Community-Daten, Y8S2). */
export const ESCALATION_SCALING: Record<number, { damage: number; health: number; armor: number }> = {
  0: { damage: 1.0, health: 1.0, armor: 1.0 },
  1: { damage: 1.5, health: 1.6, armor: 1.6 },
  2: { damage: 2.0, health: 2.0, armor: 2.0 },
  3: { damage: 2.5, health: 2.5, armor: 2.5 },
  4: { damage: 3.0, health: 3.0, armor: 3.0 },
  5: { damage: 3.5, health: 3.5, armor: 3.5 },
  6: { damage: 4.0, health: 4.5, armor: 4.5 },
  7: { damage: 4.5, health: 5.3, armor: 5.3 },
  8: { damage: 5.0, health: 6.5, armor: 6.5 },
  9: { damage: 5.5, health: 7.0, armor: 7.0 },
  10: { damage: 5.5, health: 8.0, armor: 8.0 },
};

export interface DifficultyInfo {
  key: DifficultyKey;
  label: string;
  group: "offenewelt" | "missionen" | "vergeltung" | "raid" | "incursion" | "pvp";
  /** HP-Pool solo (Mio.) je Gegnerrang; undefined bei Eskalation (dynamisch ueber Heroic x Skalierung). */
  soloPoolM: Record<EnemyRank, number> | null;
  /** Eskalationsstufe, falls zutreffend. */
  escalationTier?: number;
  /** Gegnerschaden relativ zu Heroic (1.0). */
  enemyDamageFactor: number;
  /** Anteil Ruestungsleiste am Gesamt-Pool (Approximation fuer DTA/DTH-Gewichtung). */
  armorShare: number;
}

const BASE_INFO: Record<Exclude<DifficultyKey, "story">, Omit<DifficultyInfo, "key" | "label">> = {
  normal: { group: "offenewelt", soloPoolM: SOLO_POOL_M.normal, enemyDamageFactor: 0.45, armorShare: 0.75 },
  hard: { group: "offenewelt", soloPoolM: SOLO_POOL_M.hard, enemyDamageFactor: 0.65, armorShare: 0.78 },
  challenging: { group: "offenewelt", soloPoolM: SOLO_POOL_M.challenging, enemyDamageFactor: 0.85, armorShare: 0.8 },
  heroic: { group: "offenewelt", soloPoolM: SOLO_POOL_M.heroic, enemyDamageFactor: 1.0, armorShare: 0.82 },
  legendary: { group: "offenewelt", soloPoolM: SOLO_POOL_M.legendary, enemyDamageFactor: 1.3, armorShare: 0.85 },
  escalation0: { group: "missionen", soloPoolM: SOLO_POOL_M.heroic, enemyDamageFactor: 1.0, armorShare: 0.82, escalationTier: 0 },
  escalation1: { group: "missionen", soloPoolM: null, enemyDamageFactor: 1.5, armorShare: 0.82, escalationTier: 1 },
  escalation2: { group: "missionen", soloPoolM: null, enemyDamageFactor: 2.0, armorShare: 0.82, escalationTier: 2 },
  escalation3: { group: "missionen", soloPoolM: null, enemyDamageFactor: 2.5, armorShare: 0.82, escalationTier: 3 },
  escalation4: { group: "missionen", soloPoolM: null, enemyDamageFactor: 3.0, armorShare: 0.82, escalationTier: 4 },
  escalation5: { group: "missionen", soloPoolM: null, enemyDamageFactor: 3.5, armorShare: 0.82, escalationTier: 5 },
  escalation6: { group: "missionen", soloPoolM: null, enemyDamageFactor: 4.0, armorShare: 0.84, escalationTier: 6 },
  escalation7: { group: "missionen", soloPoolM: null, enemyDamageFactor: 4.5, armorShare: 0.86, escalationTier: 7 },
  escalation8: { group: "missionen", soloPoolM: null, enemyDamageFactor: 5.0, armorShare: 0.87, escalationTier: 8 },
  escalation9: { group: "missionen", soloPoolM: null, enemyDamageFactor: 5.5, armorShare: 0.88, escalationTier: 9 },
  escalation10: { group: "missionen", soloPoolM: null, enemyDamageFactor: 5.5, armorShare: 0.89, escalationTier: 10 },
};

export const DIFFICULTIES: DifficultyInfo[] = (
  [
    ["story", "Story"],
    ["normal", "Normal"],
    ["hard", "Schwer"],
    ["challenging", "Herausfordernd"],
    ["heroic", "Heroisch"],
    ["legendary", "Legend\u00e4r"],
    ["escalation0", "Eskalation 0"],
    ["escalation1", "Eskalation 1"],
    ["escalation2", "Eskalation 2"],
    ["escalation3", "Eskalation 3"],
    ["escalation4", "Eskalation 4"],
    ["escalation5", "Eskalation 5"],
    ["escalation6", "Eskalation 6"],
    ["escalation7", "Eskalation 7"],
    ["escalation8", "Eskalation 8"],
    ["escalation9", "Eskalation 9"],
    ["escalation10", "Eskalation 10"],
  ] as Array<[DifficultyKey, string]>
).map(([key, label]) =>
  key === "story"
    ? { key, label, group: "vergeltung" as const, soloPoolM: null, enemyDamageFactor: 0.2, armorShare: 0.5 }
    : { key, label, ...BASE_INFO[key] },
);

export function difficultyInfo(key: DifficultyKey): DifficultyInfo {
  return DIFFICULTIES.find((d) => d.key === key) ?? DIFFICULTIES.find((d) => d.key === "heroic")!;
}

/** HP-Pool (Mio.) fuer Gegnerrang, Teamgroesse und Schwierigkeit. */
export function enemyPoolM(
  key: DifficultyKey,
  rank: EnemyRank,
  teamSize: 1 | 2 | 3 | 4,
): number {
  const info = difficultyInfo(key);
  const teamFactor = TEAM_FACTOR[teamSize];
  if (info.soloPoolM) {
    return info.soloPoolM[rank] * teamFactor;
  }
  if (info.escalationTier !== undefined) {
    const scaling = ESCALATION_SCALING[info.escalationTier];
    return SOLO_POOL_M.heroic[rank] * scaling.health * teamFactor;
  }
  return 0;
}

/** Zeit zum Toeten (Sekunden) eines Gegnerrangs bei gegebenem effektivem DPS. */
export function timeToKillSeconds(
  key: DifficultyKey,
  rank: EnemyRank,
  teamSize: 1 | 2 | 3 | 4,
  effectiveDps: number,
): number | null {
  if (effectiveDps <= 0) return null;
  return enemyPoolM(key, rank, teamSize) * 1_000_000 / effectiveDps;
}


/** Spielmodus-Optionen des Fragebogens (gameMode-Frage). */
export type GameModeKey = "openworld" | "missions" | "countdown" | "raid" | "incursion" | "pvp";

/**
 * Zulaessige Schwierigkeiten je Spielmodus (Vorgabe des Auftraggebers, 31.10.2026):
 * - Offene Welt / Vergeltung: Heroisch, Herausfordernd, Schwer, Normal
 * - Missionen: Eskalation 10-0 ODER Legendär, Heroisch, Herausfordernd, Schwer, Normal, Story
 * - Raid: Normal, Story
 * - Incursion: Normal
 * - Dark Zone/PvP: Konzept folgt spaeter (leer)
 */
export const GAME_MODE_DIFFICULTIES: Record<GameModeKey, DifficultyKey[]> = {
  openworld: ["heroic", "challenging", "hard", "normal"],
  countdown: ["heroic", "challenging", "hard", "normal"],
  missions: [
    "escalation10", "escalation9", "escalation8", "escalation7", "escalation6",
    "escalation5", "escalation4", "escalation3", "escalation2", "escalation1", "escalation0",
    "legendary", "heroic", "challenging", "hard", "normal", "story",
  ],
  raid: ["normal", "story"],
  incursion: ["normal"],
  pvp: [],
};

export function allowedDifficulties(gameMode: string | undefined): DifficultyKey[] {
  const key = (gameMode ?? "") as GameModeKey;
  return GAME_MODE_DIFFICULTIES[key] ?? GAME_MODE_DIFFICULTIES.missions;
}

/** Sinnvolle Vorbelegung je Spielmodus. */
export function defaultDifficultyFor(gameMode: string | undefined): DifficultyKey {
  switch (gameMode) {
    case "raid":
    case "incursion":
      return "normal";
    case "openworld":
    case "countdown":
    case "missions":
    default:
      return "heroic";
  }
}

/**
 * Prototyp-Deckelung: In Raid und Incursion gibt es keine Prototyp-Boni —
 * Prototyp-Werte zaehlen nur bis zum High-End-Maximalwert (Auftraggeber-Vorgabe:
 * Stuermermaske WD 20 % -> 15 %, CHD 17 % -> 12 %).
 */
export function prototypeCapActive(gameMode: string | undefined): boolean {
  return gameMode === "raid" || gameMode === "incursion";
}

/**
 * Stack-Sets (Stapel-basierte Boni): Bei schweren Schwierigkeitsgraden sind Kämpfe
 * kurz — Stacks bauen sich kaum auf, Westen-/Rucksack-Talent ist oft besser.
 * Ab Heroisch/Eskalation wirken Stacks voll (lange Kämpfe).
 */
export function stackSetHint(difficultyKey: string, activeStackSets: string[]): string | null {
  if (activeStackSets.length === 0) return null;
  const heavy = ["heroic", "legendary"].includes(difficultyKey) || difficultyKey.startsWith("escalation");
  if (heavy) {
    return `Lange Kämpfe bei dieser Schwierigkeit — Stack-Boni (${activeStackSets.join(", ")}) wirken voll.`;
  }
  return `Kurze Kämpfe bei dieser Schwierigkeit — Stacks (${activeStackSets.join(", ")}) bauen sich kaum auf. Prüfe Westen-/Rucksack-Talent statt hoher Stacks.`;
}

/** Markennamen der Stack-Sets (fuer stackSetHint, Kleinbuchstaben-Matching). */
export const STACK_SET_NAMES = ["striker", "heartbreaker", "umbra"];

/* ------------------------------------------------------------------ */
/* Rechnerische Prototyp-Deckelung (Raid/Incursion: "kein Prototyp")   */
/* ------------------------------------------------------------------ */

import type { GearPiece, Weapon } from "./sampleData";
import { gearAttrMax, GEAR_CORE_MAX, WEAPON_CORE1_MAX, WEAPON_CORE2_BY_TYPE, WEAPON_MINOR_MAX } from "./sampleData";

/**
 * Senkt Prototyp-Werte auf die High-End-Maxima ab (Raid/Incursion).
 * Gear: Kern + Attribute; Waffe: Kern 1, Kern 2, Minor-Attribut.
 * Beispiel (Auftraggeber): Stuermermaske WD 20 % -> 15 %, CHD 17 % -> 12 %.
 */
export function applyPrototypeCapToGear(gear: GearPiece[]): GearPiece[] {
  return gear.map((g) => {
    if (!g.prototype) return g;
    const coreMax = GEAR_CORE_MAX[g.core];
    const capped: GearPiece = {
      ...g,
      coreValue:
        g.core === "skill"
          ? Math.min(g.coreValue, 1)
          : coreMax !== undefined
            ? Math.min(g.coreValue, coreMax)
            : g.coreValue,
      attributes: g.attributes.map((a) => {
        const max = gearAttrMax(a.type, false);
        return max !== null && a.value > max ? { ...a, value: max } : a;
      }),
    };
    return capped;
  });
}

export function applyPrototypeCapToWeapon(weapon: Weapon): Weapon {
  if (!weapon.isPrototype) return weapon;
  const capAttr = (type: string | undefined, value: number | undefined) => {
    if (type === undefined || value === undefined) return value;
    const baseMax =
      type === weapon.attributes.core2Type && WEAPON_CORE2_BY_TYPE[weapon.type]?.type === type
        ? WEAPON_CORE2_BY_TYPE[weapon.type]!.max
        : WEAPON_MINOR_MAX[type as keyof typeof WEAPON_MINOR_MAX];
    if (baseMax === undefined) return value;
    return Math.min(value, baseMax);
  };
  return {
    ...weapon,
    attributes: {
      ...weapon.attributes,
      core1: Math.min(weapon.attributes.core1, WEAPON_CORE1_MAX),
      core2Val: capAttr(weapon.attributes.core2Type, weapon.attributes.core2Val) ?? weapon.attributes.core2Val,
      minorVal: capAttr(weapon.attributes.minorType, weapon.attributes.minorVal) ?? weapon.attributes.minorVal,
    },
  };
}
