import { GEAR_TALENTS, type GearTalent } from "./v4Data";
import type { GearPiece, Weapon } from "./sampleData";

/**
 * CR-02 OP-6.2: Talentmodell in Wirkungsklassen.
 * (a) permanent: dauerhafter Bonus (z. B. Unhinged +18 % WD)
 * (b) stack: Stack-/Trigger-Bonus mit Maximalstacks und Aktivzeit-Annahme
 *     (z. B. Strapaziert: +10 % CHD je 0,5 s Schießen, max. 5 Stacks)
 * (c) bedingt: situativer Bonus mit Uptime-Annahme (z. B. Killer: +70 % CHD
 *     für 10 s nach Crit-Kill)
 * (d) team: Team-Wirkung (z. B. Taktischer Link) — fließt in die buf-Achse
 * (e) unmodelliert: nicht modellierbar — wird in der Karte gekennzeichnet
 */
export type TalentClass = "permanent" | "stack" | "conditional" | "team" | "unmodelled";

export interface WeaponTalentEffect {
  key: string;
  name: string;
  talentClass: TalentClass;
  /** Beitrag in Prozent zur jeweiligen Kategorie (0 bei unmodelliert). */
  value: number;
  category: "wd" | "chd" | "rof" | "amp" | "other";
  modeled: boolean;
  note: string;
}

export interface GearTalentEffect {
  key: string;
  name: string;
  talentClass: TalentClass;
  value: number;
  category: "wd" | "chd" | "amp" | "skill" | "other";
  modeled: boolean;
  team: boolean;
  note: string;
}

export interface BuildTalentContribution {
  weaponTalent: WeaponTalentEffect | null;
  gearTalents: GearTalentEffect[];
  /** Summe additiver WD-Prozentbeiträge aus modellierten Talenten. */
  wdPercent: number;
  /** CHD-Prozentbeitrag (stack/bedingt mit Standard-Annahmen). */
  chdPercent: number;
  /** RoF-Prozentbeitrag. */
  rofPercent: number;
  /** Amp-Beiträge (multiplikativ). */
  ampPercents: number[];
  /** Team-Buff-Beiträge für die buf-Achse. */
  teamBuffPercents: number[];
  /** Talente, die wir nicht modellieren — Kennzeichnung in der UI. */
  unmodelled: string[];
}

/** Standard-Annahmen für Stack-/Aktivzeit (OP-6.3, mit Reglern im Annahmen-Panel). */
export interface TalentAssumptions {
  /** Angenommene Kampf-Dauer in Sekunden (bestimmt Stack-Aufbau). */
  combatWindowSeconds: number;
  /** Anteil der Zeit, in der bedingte Boni aktiv sind (0–1). */
  conditionalUptime: number;
  /** Stack-Aufbau: Anteil der maximalen Stacks, die im Schnitt aktiv sind. */
  stackUptime: number;
}

export const DEFAULT_TALENT_ASSUMPTIONS: TalentAssumptions = {
  combatWindowSeconds: 30,
  conditionalUptime: 0.5,
  stackUptime: 0.8,
};

interface WeaponTalentRule {
  match: RegExp;
  talentClass: TalentClass;
  category: WeaponTalentEffect["category"];
  /** value je nach Klasse: permanent = Prozent; stack = Prozent pro Stack × Stacks; conditional = Prozent × Uptime. */
  value: number;
  stacks?: number;
  uptime?: number;
  note: string;
}

const WEAPON_TALENT_RULES: WeaponTalentRule[] = [
  {
    match: /strapaziert/i,
    talentClass: "stack",
    category: "chd",
    value: 10,
    stacks: 5,
    note: "+10 % CHD je 0,5 s Schießen, max. 5 Stacks (talents-display.json)",
  },
  {
    match: /killer/i,
    talentClass: "conditional",
    category: "chd",
    value: 70,
    uptime: 10 / 30,
    note: "+70 % CHD für 10 s nach Crit-Kill (talents-display.json)",
  },
  {
    match: /raserei|frenzy/i,
    talentClass: "conditional",
    category: "wd",
    value: 15,
    uptime: 9 / 30,
    note: "+3 % RoF & +3 % WD je 10 Kugeln Magazin für 9 s nach Leer-Nachladen; 50er-Magazin = +15 % (talents-display.json)",
  },
  {
    match: /unhinged/i,
    talentClass: "permanent",
    category: "wd",
    value: 18,
    note: "LMG: +18 % WD dauerhaft (talent.json)",
  },
  {
    match: /overwhelm/i,
    talentClass: "conditional",
    category: "wd",
    value: 40,
    uptime: 0.5,
    note: "LMG: +40 % WD bedingt (talent.json, geschätzt)",
  },
  {
    match: /pummel|pumped up/i,
    talentClass: "conditional",
    category: "wd",
    value: 35,
    uptime: 0.5,
    note: "Shotgun: +30–40 % WD bedingt (talent.json)",
  },
  {
    match: /rifleman/i,
    talentClass: "stack",
    category: "wd",
    value: 10,
    stacks: 5,
    note: "5 Kopfschuss-Stacks à +10 % WD für 5 s (talent.json)",
  },
  {
    match: /measured/i,
    talentClass: "conditional",
    category: "wd",
    value: 30,
    uptime: 0.4,
    note: "+30 % WD nach Magazin leer (talent.json)",
  },
  {
    match: /brazen/i,
    talentClass: "conditional",
    category: "amp",
    value: 21,
    uptime: 0.5,
    note: "Shotgun: +21 % Amp bedingt (talent.json, geschätzt)",
  },
  {
    match: /finisher/i,
    talentClass: "conditional",
    category: "chd",
    value: 30,
    uptime: 0.4,
    note: "Pistole: +30 % CHC/CHD bedingt (talent.json)",
  },
  {
    match: /precision strike/i,
    talentClass: "conditional",
    category: "amp",
    value: 20,
    uptime: 0.5,
    note: "+20 % Amp bedingt (talent.json)",
  },
];

export function weaponTalentEffect(
  weapon: Weapon | null | undefined,
  assumptions: TalentAssumptions = DEFAULT_TALENT_ASSUMPTIONS,
): WeaponTalentEffect | null {
  if (!weapon?.talent) return null;
  const name = weapon.talent;
  for (const rule of WEAPON_TALENT_RULES) {
    if (!rule.match.test(name)) continue;
    let value = rule.value;
    let talentClass = rule.talentClass;
    if (rule.talentClass === "stack") {
      value = rule.value * (rule.stacks ?? 1) * assumptions.stackUptime;
    } else if (rule.talentClass === "conditional") {
      value = rule.value * (rule.uptime ?? assumptions.conditionalUptime);
    }
    return {
      key: name,
      name,
      talentClass,
      value: Math.round(value * 10) / 10,
      category: rule.category,
      modeled: true,
      note: rule.note,
    };
  }
  return {
    key: name,
    name,
    talentClass: "unmodelled",
    value: 0,
    category: "other",
    modeled: false,
    note: `Talent „${name}“ ist nicht modelliert (Wirkungsklasse e) — in der Build-Karte gekennzeichnet.`,
  };
}

const GEAR_TALENT_CLASS_BY_KEY: Record<string, { talentClass: TalentClass; category: GearTalentEffect["category"] }> = {
  vigilance: { talentClass: "conditional", category: "wd" },
  spark: { talentClass: "conditional", category: "skill" },
};

export function gearTalentEffect(
  talent: GearTalent,
  assumptions: TalentAssumptions = DEFAULT_TALENT_ASSUMPTIONS,
): GearTalentEffect {
  const cls = GEAR_TALENT_CLASS_BY_KEY[talent.key];
  const value = talent.wert ?? 0;
  if (talent.team_wirkung) {
    return {
      key: talent.key,
      name: talent.name,
      talentClass: "team",
      value,
      category: "other",
      modeled: true,
      team: true,
      note: talent.description,
    };
  }
  if (!cls) {
    return {
      key: talent.key,
      name: talent.name,
      talentClass: "unmodelled",
      value: 0,
      category: "other",
      modeled: false,
      team: false,
      note: `Gear-Talent „${talent.name}“ ist nicht modelliert — gekennzeichnet.`,
    };
  }
  const eff = cls.talentClass === "conditional" ? value * (talent.uptime ?? assumptions.conditionalUptime) : value;
  return {
    key: talent.key,
    name: talent.name,
    talentClass: cls.talentClass,
    value: Math.round(eff * 10) / 10,
    category: cls.category,
    modeled: true,
    team: false,
    note: talent.description,
  };
}

export function gearTalentByName(name: string | null | undefined): GearTalent | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  return (
    GEAR_TALENTS.find(
      (t) => t.name.toLowerCase() === lower || t.key.toLowerCase() === lower || lower.includes(t.key.toLowerCase()),
    ) ?? null
  );
}

/** Sammelt alle Talent-Beiträge eines Builds (Waffe + Gear-Talente). */
export function collectTalentContributions(
  weapon: Weapon | null,
  gear: GearPiece[],
  assumptions: TalentAssumptions = DEFAULT_TALENT_ASSUMPTIONS,
): BuildTalentContribution {
  const wt = weaponTalentEffect(weapon, assumptions);
  const gearTalents: GearTalentEffect[] = [];
  const unmodelled: string[] = [];
  let wdPercent = 0;
  let chdPercent = 0;
  let rofPercent = 0;
  const ampPercents: number[] = [];
  const teamBuffPercents: number[] = [];

  if (wt) {
    if (!wt.modeled) unmodelled.push(wt.name);
    else if (wt.category === "wd") wdPercent += wt.value;
    else if (wt.category === "chd") chdPercent += wt.value;
    else if (wt.category === "rof") rofPercent += wt.value;
    else if (wt.category === "amp") ampPercents.push(wt.value);
  }
  for (const g of gear) {
    const t = gearTalentByName(g.talent);
    if (!t) {
      if (g.talent) unmodelled.push(g.talent);
      continue;
    }
    const eff = gearTalentEffect(t, assumptions);
    gearTalents.push(eff);
    if (!eff.modeled) {
      unmodelled.push(eff.name);
      continue;
    }
    if (eff.team) teamBuffPercents.push(eff.value);
    else if (eff.category === "wd") wdPercent += eff.value;
    else if (eff.category === "chd") chdPercent += eff.value;
    else if (eff.category === "amp") ampPercents.push(eff.value);
  }

  return {
    weaponTalent: wt,
    gearTalents,
    wdPercent: Math.round(wdPercent * 10) / 10,
    chdPercent: Math.round(chdPercent * 10) / 10,
    rofPercent: Math.round(rofPercent * 10) / 10,
    ampPercents,
    teamBuffPercents,
    unmodelled,
  };
}
