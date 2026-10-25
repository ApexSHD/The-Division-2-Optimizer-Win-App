import type { Weapon } from "./sampleData";
import { normalizeWeapon } from "./sampleData";
import { WEAPON_ATTR_LABELS } from "./sampleData";
import type { WeaponType, Rarity, WeaponAttrKey } from "./sampleData";

const CSV_SEPARATOR = ";";

const HEADERS = [
  "Name",
  "Typ",
  "Art",
  "Prototyp",
  "Attribut 1",
  "Attribut 2",
  "Attribut 3",
  "Talent",
  "Basis-DPS",
  "Schaden/Magazin",
  "Grundschaden",
  "Feuerrate",
  "Magazingröße",
  "Know-How",
];

const TYPE_LABELS: Record<WeaponType, string> = {
  ar: "Sturmgewehr",
  smg: "MP",
  lmg: "LMG",
  rifle: "Gewehr",
  mmr: "DMR",
  shotgun: "Schrotflinte",
  pistol: "Pistole",
};

const RARITY_LABELS: Record<Rarity, string> = {
  highend: "High-End",
  named: "Named",
  exotic: "Exotic",
};

function formatNumberDe(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function attrLabel(type: keyof typeof WEAPON_ATTR_LABELS, val: number): string {
  return `${WEAPON_ATTR_LABELS[type]} +${formatNumberDe(val)} %`;
}

function csvEscape(value: string): string {
  if (value.includes(CSV_SEPARATOR) || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function weaponsToCsv(weapons: Weapon[]): string {
  const lines = [HEADERS.join(CSV_SEPARATOR)];
  for (const w of weapons) {
    const dps = (w.baseDamage * w.rpm) / 60;
    const dmgMag = w.baseDamage * w.magSize;
    lines.push(
      [
        w.name,
        TYPE_LABELS[w.type],
        RARITY_LABELS[w.rarity],
        w.isPrototype ? "ja" : "nein",
        `Waffenschaden (WD) +${formatNumberDe(w.attributes.core1)} %`,
        attrLabel(w.attributes.core2Type, w.attributes.core2Val),
        attrLabel(w.attributes.minorType, w.attributes.minorVal),
        w.talent,
        formatNumberDe(Math.round(dps)),
        formatNumberDe(Math.round(dmgMag)),
        String(w.baseDamage),
        String(w.rpm),
        String(w.magSize),
        String(w.knowHow),
      ]
        .map(csvEscape)
        .join(CSV_SEPARATOR),
    );
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === CSV_SEPARATOR) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseGermanNumber(raw: string): number {
  const cleaned = raw.replace(/\s|\u00a0/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseAttrValue(cell: string): number {
  const match = cell.match(/\+\s*([\d.,]+)\s*%/);
  return match ? parseGermanNumber(match[1]) : 0;
}

function parseAttrCell(cell: string): { type: WeaponAttrKey; value: number } | null {
  const trimmed = cell.trim();
  if (!trimmed) return null;
  const value = parseAttrValue(trimmed);
  const label = trimmed.replace(/\+\s*[\d.,]+\s*%/, "").trim().toLowerCase();
  let best: { key: WeaponAttrKey; len: number } | null = null;
  for (const [key, cfg] of Object.entries(WEAPON_ATTR_LABELS) as [WeaponAttrKey, string][]) {
    const l = cfg.toLowerCase();
    if (label.startsWith(l) && (!best || l.length > best.len)) {
      best = { key, len: l.length };
    }
  }
  return best ? { type: best.key, value } : null;
}

function parseTypeLabel(label: string): WeaponType | null {
  const l = label.trim().toLowerCase();
  if (l.startsWith("sturm")) return "ar";
  if (l.startsWith("maschinenp")) return "smg";
  if (l.startsWith("mp")) return "smg";
  if (l.startsWith("lmg") || l.startsWith("leicht")) return "lmg";
  if (l.startsWith("gewehr")) return "rifle";
  if (l === "rifle") return "rifle";
  if (l.startsWith("dmr") || l.startsWith("scharf") || l.startsWith("präz")) return "mmr";
  if (l.startsWith("schrot")) return "shotgun";
  if (l.startsWith("pistol")) return "pistol";
  return null;
}

function parseRarityLabel(label: string): Rarity {
  const l = label.trim().toLowerCase();
  if (l.startsWith("exot") || l === "exotic") return "exotic";
  if (l.startsWith("named")) return "named";
  return "highend";
}

export interface CsvImportResult {
  weapons: Weapon[];
  skippedRows: number;
}

export function weaponsFromCsv(csv: string, makeId: () => string): CsvImportResult {
  const text = csv.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { weapons: [], skippedRows: 0 };
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const nameIdx = header.findIndex((h) => h === "name");
  if (nameIdx === -1) throw new Error("CSV ohne 'Name'-Spalte");

  const col = (needle: string) => header.findIndex((h) => h.startsWith(needle));
  const typeIdx = col("typ");
  const rarityIdx = col("art");
  const protoIdx = col("prototyp");
  const talentIdx = col("talent");
  const khIdx = col("know-how");
  const a1Idx = col("attribut 1");
  const a2Idx = col("attribut 2");
  const a3Idx = col("attribut 3");
  const baseDmgIdx = col("grundschaden");
  const rpmIdx = col("feuerrate");
  const magIdx = col("magazingr");

  const weapons: Weapon[] = [];
  let skippedRows = 0;
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const name = (cells[nameIdx] ?? "").trim();
    if (!name) {
      skippedRows++;
      continue;
    }
    const parsedType = typeIdx >= 0 ? parseTypeLabel(cells[typeIdx] ?? "") : "ar";
    if (!parsedType) {
      skippedRows++;
      continue;
    }
    const type = parsedType;
    const rarity = rarityIdx >= 0 ? parseRarityLabel(cells[rarityIdx] ?? "") : "highend";
    const isPrototype =
      rarity !== "exotic" && (protoIdx >= 0 ? (cells[protoIdx] ?? "").trim().toLowerCase().startsWith("j") : false);
    const knowHow = khIdx >= 0 ? Math.max(0, Math.min(30, parseGermanNumber(cells[khIdx] ?? "30"))) : 30;

    const a1Cell = a1Idx >= 0 ? (cells[a1Idx] ?? "").trim() : "";
    const core1Parsed = a1Cell ? parseAttrValue(a1Cell) : undefined;
    const a2Cell = a2Idx >= 0 ? (cells[a2Idx] ?? "").trim() : "";
    const a3Cell = a3Idx >= 0 ? (cells[a3Idx] ?? "").trim() : "";
    if ((a2Cell && !parseAttrCell(a2Cell)) || (a3Cell && !parseAttrCell(a3Cell))) {
      skippedRows++;
      continue;
    }
    const a2 = a2Cell ? parseAttrCell(a2Cell) : null;
    const a3 = a3Cell ? parseAttrCell(a3Cell) : null;

    const core1 = core1Parsed !== undefined ? core1Parsed : undefined;
    const core2Type = a2 ? a2.type : undefined;
    const core2Val = a2 ? a2.value : undefined;
    const minorType = a3 ? a3.type : undefined;
    const minorVal = a3 ? a3.value : undefined;

    weapons.push(
      normalizeWeapon({
        id: makeId(),
        name,
        type,
        rarity,
        talent: talentIdx >= 0 ? (cells[talentIdx] ?? "").trim() : "",
        knowHow: isPrototype ? 30 : knowHow,
        isPrototype,
        baseDamage: baseDmgIdx >= 0 ? parseGermanNumber(cells[baseDmgIdx] ?? "0") : undefined,
        rpm: rpmIdx >= 0 ? parseGermanNumber(cells[rpmIdx] ?? "0") : undefined,
        magSize: magIdx >= 0 ? parseGermanNumber(cells[magIdx] ?? "0") : undefined,
        attributes:
          core1 !== undefined || core2Type !== undefined || minorType !== undefined
            ? {
                core1: core1 ?? 0,
                core2Type: (core2Type ?? "dth") as Weapon["attributes"]["core2Type"],
                core2Val: core2Val ?? 0,
                minorType: (minorType ?? "dttooc") as Weapon["attributes"]["minorType"],
                minorVal: minorVal ?? 0,
              }
            : undefined,
      }),
    );
  }
  return { weapons, skippedRows };
}
