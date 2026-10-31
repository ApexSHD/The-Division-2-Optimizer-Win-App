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
