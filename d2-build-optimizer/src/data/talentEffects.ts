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
  // --- CR-02 P4 Paket 2: alle Waffentalente aus talents-display.json (Allgemeine Waffen) ---
  { match: /bewahrung/i, talentClass: "conditional", category: "other", value: 10, uptime: 5 / 30, note: "Kill repariert 10 % Rüstung über 5 s (kein DPS-Beitrag, EHP)" },
  { match: /^blind$/i, talentClass: "conditional", category: "amp", value: 30, uptime: 0.3, note: "+30 % Amp gegen geblendete Gegner (talents-display.json)" },
  { match: /brotkorb/i, talentClass: "stack", category: "other", value: 55, stacks: 3, note: "+55 % HSD zum nächsten Kopfschuss, max. 3 Stacks (HSD-Beitrag, nicht direkt DPS)" },
  { match: /donnerkeil/i, talentClass: "conditional", category: "amp", value: 30, uptime: 0.3, note: "+30 % gegen schockierte Ziele" },
  { match: /druckpunkt/i, talentClass: "conditional", category: "amp", value: 15, uptime: 0.4, note: "+15 % gegen Gegner unter Statuseffekt" },
  { match: /entzündet|entzundet/i, talentClass: "conditional", category: "amp", value: 25, uptime: 0.3, note: "+25 % gegen brennende Gegner" },
  { match: /flachlage/i, talentClass: "conditional", category: "amp", value: 15, uptime: 0.3, note: "+15 % gegen gepulste Gegner" },
  { match: /flinke hände/i, talentClass: "stack", category: "other", value: 3, stacks: 40, note: "+3 % Nachladetempo je Crit, max. 40 Stacks (Reload-DPS)" },
  { match: /immobilisieren/i, talentClass: "conditional", category: "amp", value: 20, uptime: 0.3, note: "+20 % gegen gefesselte Gegner" },
  { match: /kopfkratzer/i, talentClass: "conditional", category: "amp", value: 30, uptime: 0.3, note: "+30 % gegen verwirrte Gegner" },
  { match: /nah und persönlich/i, talentClass: "conditional", category: "wd", value: 30, uptime: 10 / 30, note: "Kill < 7 m: +30 % WD für 10 s" },
  { match: /optimist/i, talentClass: "conditional", category: "wd", value: 35, uptime: 0.7, note: "+3,5 % WD je 10 % fehlende Munition (~+35 % im Schnitt)" },
  { match: /rachsüchtig|rachsuchti/i, talentClass: "conditional", category: "chd", value: 16, uptime: 15 / 30, note: "Status-Kill: +16 % CHC/CHD für 15 s (Team 15 m)" },
  { match: /sadist/i, talentClass: "conditional", category: "amp", value: 30, uptime: 0.3, note: "+30 % gegen blutende Gegner" },
  { match: /schütze|schutze/i, talentClass: "conditional", category: "amp", value: 10, uptime: 0.5, note: "+2 % je 4 m Entfernung (Ø +10 %)" },
  { match: /schwachpunkt/i, talentClass: "conditional", category: "wd", value: 19, uptime: 15 / 30, note: "Schwachpunkt zerstört: +19 % WD für 15 s" },
  { match: /stabil/i, talentClass: "stack", category: "other", value: 1, stacks: 100, note: "+1 % Genauigkeit/Stabilität je Treffer (Handling, nicht direkt DPS)" },
  { match: /stromlinie/i, talentClass: "conditional", category: "wd", value: 42, uptime: 0.6, note: "+42 % WD wenn keine Skills aktiv/in Cooldown" },
  { match: /synchronisiert/i, talentClass: "conditional", category: "other", value: 15, uptime: 5 / 30, note: "+15 % Skill-Schaden für 5 s (Skill-Achse, nicht Waffe)" },
  { match: /spike/i, talentClass: "conditional", category: "other", value: 20, uptime: 15 / 30, note: "Kopfschuss: +20 % Skill-Schaden für 15 s (Skill-Achse)" },
  { match: /bewahrung/i, talentClass: "conditional", category: "other", value: 10, uptime: 5 / 30, note: "Kill: +10 % Rüstungs-Reparatur über 5 s (EHP)" },
  { match: /reformation/i, talentClass: "conditional", category: "other", value: 60, uptime: 15 / 30, note: "Kopfschuss: +60 % Skill-Reparatur für 15 s" },
  { match: /verlängerung/i, talentClass: "conditional", category: "other", value: 75, uptime: 0.2, note: "Kopfschuss: +75 % Status-Dauer/-Schaden (CC-Achse)" },
  { match: /zukunft/i, talentClass: "stack", category: "other", value: 1, stacks: 3, note: "+1 Skill-Stufe je Waffen-Kill für 15 s, max. 3 (Skill-Achse)" },
  { match: /vorschlaghammer/i, talentClass: "conditional", category: "amp", value: 15, uptime: 0.2, note: "Granate markiert: +15 % nur gegen Rüstung" },
  // Perfekt-Varianten (Werte in Klammern = perfekt)
  { match: /perfekt strapaziert/i, talentClass: "stack", category: "chd", value: 10, stacks: 8, note: "Perfekt: max. 8 Stacks statt 5" },
  { match: /perfekter killer/i, talentClass: "conditional", category: "chd", value: 90, uptime: 10 / 30, note: "Perfekt: +90 % statt 70 % CHD" },
  { match: /perfekter optimist/i, talentClass: "conditional", category: "wd", value: 45, uptime: 0.7, note: "Perfekt: +4,5 % je 10 % Muni" },
  { match: /perfekte stromlinie/i, talentClass: "conditional", category: "wd", value: 47, uptime: 0.6, note: "Perfekt: +47 % WD" },
  { match: /perfekt blind/i, talentClass: "conditional", category: "amp", value: 35, uptime: 0.3, note: "Perfekt: +35 % Amp gegen Geblendete" },
  { match: /perfekt rachsüchtig/i, talentClass: "conditional", category: "chd", value: 21, uptime: 15 / 30, note: "Perfekt: +21 % CHC/CHD, 20 m Radius" },
  { match: /perfekter sadist/i, talentClass: "conditional", category: "amp", value: 35, uptime: 0.3, note: "Perfekt: +35 % gegen Blutende" },
  { match: /perfekter schütze/i, talentClass: "conditional", category: "amp", value: 15, uptime: 0.5, note: "Perfekt: +2 % je 3 m" },
  { match: /perfekter schwachpunkt/i, talentClass: "conditional", category: "wd", value: 24, uptime: 15 / 30, note: "Perfekt: +24 % WD" },
  { match: /perfekter spike/i, talentClass: "conditional", category: "other", value: 25, uptime: 15 / 30, note: "Perfekt: +25 % Skill-Schaden" },
  { match: /perfekter brotkorb/i, talentClass: "stack", category: "other", value: 70, stacks: 3, note: "Perfekt: +70 % HSD-Stack" },
  { match: /perfekter donnerkeil/i, talentClass: "conditional", category: "amp", value: 35, uptime: 0.3, note: "Perfekt: +35 % gegen Schock" },
  { match: /perfekter druckpunkt/i, talentClass: "conditional", category: "amp", value: 20, uptime: 0.4, note: "Perfekt: +20 % gegen Status" },
  { match: /perfekteBewahrung|perfekte bewahrung/i, talentClass: "conditional", category: "other", value: 15, uptime: 5 / 30, note: "Perfekt: +15 % Rüstungs-Reparatur" },
  { match: /perfekte flinke hände/i, talentClass: "stack", category: "other", value: 5, stacks: 40, note: "Perfekt: +5 % Nachladen je Crit" },
  { match: /perfekte reformation/i, talentClass: "conditional", category: "other", value: 80, uptime: 15 / 30, note: "Perfekt: +80 % Skill-Reparatur" },
  { match: /perfekte verlängerung/i, talentClass: "conditional", category: "other", value: 75, uptime: 0.2, note: "Perfekt: +75 % Status" },
  { match: /perfekte zukunft/i, talentClass: "stack", category: "other", value: 1, stacks: 4, note: "Perfekt: +1 Skill-Stufe, max. 4, 19 s" },
  { match: /perfekt immobilisieren/i, talentClass: "conditional", category: "amp", value: 25, uptime: 0.3, note: "Perfekt: +25 % gegen Gefesselte" },
  { match: /perfekt entzündet|perfekt entzundet/i, talentClass: "conditional", category: "amp", value: 30, uptime: 0.3, note: "Perfekt: +30 % gegen Brennende" },
  { match: /perfekte flachlage/i, talentClass: "conditional", category: "amp", value: 20, uptime: 0.3, note: "Perfekt: +20 % gegen Gepulste" },
  { match: /perfekter kopfkratzer/i, talentClass: "conditional", category: "amp", value: 35, uptime: 0.3, note: "Perfekt: +35 % gegen Verwirrte" },
  { match: /perfekt nah und persönlich/i, talentClass: "conditional", category: "wd", value: 38, uptime: 10 / 30, note: "Perfekt: +38 % WD < 7 m" },
  { match: /perfekter vorschlaghammer/i, talentClass: "conditional", category: "amp", value: 20, uptime: 0.2, note: "Perfekt: +20 % gegen markierte (Rüstung)" },

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

export interface ExoticPerkEffect {
  name: string;
  talentClass: TalentClass;
  wdPercent: number;
  chdPercent: number;
  ampPercents: number[];
  chcPercent: number;
  modeled: boolean;
  note: string;
}

interface ExoticPerkRule {
  match: RegExp;
  talentClass: TalentClass;
  wdPercent: number;
  chdPercent: number;
  chcPercent: number;
  ampPercents: number[];
  note: string;
}

// CR-02 P4 Paket 2: Exotic-Perks (Auswahl der Schadens-relevanten), Werte aus gear.json perk-Feld
const EXOTIC_PERK_RULES: ExoticPerkRule[] = [
  { match: /catalyst/i, talentClass: "stack", wdPercent: 2 * 12 * 0.8, chdPercent: 0, chcPercent: 0, ampPercents: [], note: "Catalysis: max. 12 Stacks à +2 % WD (× stackUptime 0,8)" },
  { match: /memento/i, talentClass: "stack", wdPercent: 1 * 30 * 0.8, chdPercent: 0, chcPercent: 0, ampPercents: [], note: "Kill Confirmed: max. 30 Trophäen à +1 % WD/Skill-Effizienz (× 0,8)" },
  { match: /coyote/i, talentClass: "conditional", wdPercent: 0, chdPercent: 25 * 0.3, chcPercent: 25 * 0.3, ampPercents: [], note: "Coyote's Mask: 0–15 m +25 % CHD, 25 m+ +25 % CHC (Ø 30 % Uptime)" },
  { match: /bloody knuckles/i, talentClass: "conditional", wdPercent: 25 * (20 / 30), chdPercent: 0, chcPercent: 0, ampPercents: [], note: "Over the Top: +25 % WD für 20 s nach Granaten-/Nahkampf-Treffer" },
  { match: /overdogs/i, talentClass: "conditional", wdPercent: 0, chdPercent: 0, chcPercent: 0, ampPercents: [30 * 0.5], note: "Weakest Link: +30 % Amp gegen niederrangige Gegner (50 % Uptime)" },
  { match: /blacklisters/i, talentClass: "conditional", wdPercent: 0, chdPercent: 0, chcPercent: 0, ampPercents: [30 * 0.4], note: "Ostracize: markierter Gegner +30 % Amp von dir (40 % Uptime)" },
  { match: /sawyer/i, talentClass: "stack", wdPercent: 3 * 10 * 0.8, chdPercent: 0, chcPercent: 0, ampPercents: [], note: "Stand Your Ground: +3 % WD je Sekunde Stillstand, max. 10 Stacks (× 0,8)" },
  { match: /sarna|sarru/i, talentClass: "conditional", wdPercent: 15 * 0.5, chdPercent: 0, chcPercent: 0, ampPercents: [], note: "Sarru Decoy King: Ø +15 % amplified damage (Mondzyklus, 50 % Uptime)" },
  { match: /catharsis/i, talentClass: "stack", wdPercent: 1.5 * 30 * 0.8, chdPercent: 0, chcPercent: 0, ampPercents: [], note: "Catharsis: 30 Stacks à +1,5 % WD durch erlittenen Schaden (× 0,8)" },
  { match: /provocator/i, talentClass: "conditional", wdPercent: 0, chdPercent: 0, chcPercent: 0, ampPercents: [], note: "Challenger: +25 % Schadensresistenz < 20 m (EHP, kein DPS)" },
  { match: /collector/i, talentClass: "permanent", wdPercent: 0, chdPercent: 0, chcPercent: 0, ampPercents: [], note: "Hoarder: +35 % Granatenschaden (Skill-Achse, kein Waffen-DPS)" },
  { match: /ridgeway/i, talentClass: "conditional", wdPercent: 0, chdPercent: 0, chcPercent: 0, ampPercents: [], note: "Bleeding Edge: Rüstungs-Reparatur je blutendem Gegner (EHP)" },
  { match: /imperial dynasty/i, talentClass: "conditional", wdPercent: 0, chdPercent: 0, chcPercent: 0, ampPercents: [35 * 0.2], note: "Dragon's Glare: Brennen verbreitet (DoT, 20 % Uptime als Amp-Näherung)" },
];

/** Exotic-Perk eines Gear-Teils (brandType exotic) — schadensrelevante Modellierung. */
export function exoticPerkEffect(gearPiece: GearPiece): ExoticPerkEffect | null {
  if (gearPiece.brandType !== "exotic") return null;
  const name = gearPiece.brand;
  for (const rule of EXOTIC_PERK_RULES) {
    if (!rule.match.test(name)) continue;
    return {
      name,
      talentClass: rule.talentClass,
      wdPercent: Math.round(rule.wdPercent * 10) / 10,
      chdPercent: Math.round(rule.chdPercent * 10) / 10,
      ampPercents: rule.ampPercents,
      chcPercent: Math.round(rule.chcPercent * 10) / 10,
      modeled: true,
      note: rule.note,
    };
  }
  return {
    name,
    talentClass: "unmodelled",
    wdPercent: 0,
    chdPercent: 0,
    ampPercents: [],
    chcPercent: 0,
    modeled: false,
    note: `Exotic-Perk „${name}“ ist nicht modelliert — gekennzeichnet.`,
  };
}

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

// CR-02 P4 Paket 2: alle Gear-Talente aus talent.json (Weste + Rucksack + Exotic/Set)
const GEAR_TALENT_CLASS_BY_KEY: Record<string, { talentClass: TalentClass; category: GearTalentEffect["category"]; amp?: boolean }> = {
  vigilance: { talentClass: "conditional", category: "wd", amp: true },
  perfect_vigilance: { talentClass: "conditional", category: "wd", amp: true },
  composure: { talentClass: "conditional", category: "wd", amp: true },
  intimidate: { talentClass: "conditional", category: "amp", amp: true },
  spark: { talentClass: "conditional", category: "skill" },
  clutch: { talentClass: "conditional", category: "other" },
  galvanize: { talentClass: "team", category: "other" },
  perfect_galvanize: { talentClass: "team", category: "other" },
  overwatch: { talentClass: "team", category: "other" },
  future_initiative_backpack: { talentClass: "team", category: "other" },
  future_initiative_chest: { talentClass: "team", category: "other" },
  coyote_mask: { talentClass: "team", category: "other" },
  momento: { talentClass: "stack", category: "wd" },
  striker_gamble: { talentClass: "stack", category: "wd" },
  eclipse_protocol: { talentClass: "conditional", category: "other" },
};

export function gearTalentEffect(
  talent: GearTalent,
  assumptions: TalentAssumptions = DEFAULT_TALENT_ASSUMPTIONS,
): GearTalentEffect {
  const cls = GEAR_TALENT_CLASS_BY_KEY[talent.key];
  const rawValue = talent.wert ?? 0;
  const value = rawValue;
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
  let eff = value;
  if (cls.talentClass === "conditional") eff = value * (talent.uptime ?? assumptions.conditionalUptime);
  if (cls.talentClass === "stack") {
    // Stapel-Angabe parsen (z. B. „langfristig max. 30 Stapel“, „max. 100 (Weste 200)“)
    const m = (talent.stapel ?? "").match(/max\.?\s*(\d+)/i);
    const stacks = m ? Number(m[1]) : 1;
    eff = value * stacks * assumptions.stackUptime;
  }
  return {
    key: talent.key,
    name: talent.name,
    talentClass: cls.talentClass,
    value: Math.round(eff * 10) / 10,
    category: cls.amp ? "amp" : cls.category,
    modeled: true,
    team: false,
    note: talent.description,
  };
}

// DE-Anzeigename -> DB-Key für Gear-Talente (talent.json nutzt EN-Keys, CSV nutzt DE-Namen)
const GEAR_TALENT_DE_ALIAS: Record<string, string> = {
  "einschüchtern": "intimidate",
  "einschuchtern": "intimidate",
  "wachsamkeit": "vigilance",
  "gelassenheit": "composure",
  "funke": "spark",
  "kupplung": "clutch",
  "galvanize": "galvanize",
  "überwachung": "overwatch",
  "ueberwachung": "overwatch",
  "memento": "momento",
  "coyote's mask": "coyote_mask",
  "striker's gamble": "striker_gamble",
};

export function gearTalentByName(name: string | null | undefined): GearTalent | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  const folded = lower.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const aliasKey = GEAR_TALENT_DE_ALIAS[lower] ?? GEAR_TALENT_DE_ALIAS[folded];
  return (
    GEAR_TALENTS.find((t) => t.key === aliasKey) ??
    GEAR_TALENTS.find((t) => {
      const tn = t.name.toLowerCase();
      const tk = t.key.toLowerCase();
      return tn === lower || tk === lower || lower.includes(tk) || folded.includes(tn.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ""));
    }) ??
    // DE-Anzeigename matcht gegen key: „Einschüchtern“ -> intimidate, „Wachsamkeit …“ -> vigilance
    GEAR_TALENTS.find((t) => {
      const de = t.name.toLowerCase();
      const key = t.key.toLowerCase();
      return lower.includes(key) || folded.replace(/[^a-z0-9]/g, "").includes(key.replace(/[^a-z0-9]/g, "")) || de.split(" ")[0] === lower.split(" ")[0];
    }) ??
    null
  );
}

/** Sammelt alle Talent-Beiträge eines Builds (Waffe + Gear-Talente). */
export function collectTalentContributions(
  weapon: Weapon | null,
  gear: GearPiece[],
  assumptions: TalentAssumptions = DEFAULT_TALENT_ASSUMPTIONS,
  considerPerks = true,
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
    const perk = considerPerks ? exoticPerkEffect(g) : null;
    if (perk) {
      if (!perk.modeled) unmodelled.push(`Perk: ${perk.name}`);
      else {
        if (perk.wdPercent > 0) wdPercent += perk.wdPercent;
        if (perk.chdPercent > 0) chdPercent += perk.chdPercent;
        if (perk.chcPercent > 0) chdPercent += 0; // CHC-Perks landen als CHD-Näherung? nein: separat nicht nötig für DPS-Ranking
        ampPercents.push(...perk.ampPercents);
      }
    }
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
    // „other“/skill/eHP: bewusst kein DPS-Beitrag, bleibt in gearTalents sichtbar
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
