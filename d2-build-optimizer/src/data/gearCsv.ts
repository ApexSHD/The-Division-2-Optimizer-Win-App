import type { GearPiece, GearSlot, GearCoreType, GearAttrKey } from "./sampleData";
import { GEAR_CORE_LABELS, GEAR_ATTR_TYPES, normalizeGear } from "./sampleData";

const CSV_SEPARATOR = ";";

const HEADERS = [
  "Slot",
  "Marke/Set",
  "Besonderheit",
  "Prototyp",
  "1. Attribut",
  "2. Attribut",
  "3. Attribut",
  "Talent",
];

const SLOT_LABELS: Record<GearSlot, string> = {
  mask: "Maske",
  chest: "Weste",
  holster: "Holster",
  backpack: "Rucksack",
  gloves: "Handschuhe",
  kneepads: "Knieschoner",
};

const RARITY_LABELS: Record<GearPiece["brandType"], string> = {
  brand: "High-End",
  gearset: "Gear-Set",
  named: "Named",
  exotic: "Exotic",
};

function formatNumberDe(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function csvEscape(value: string): string {
  if (value.includes(CSV_SEPARATOR) || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function gearToCsv(gear: GearPiece[]): string {
  const lines = [HEADERS.join(CSV_SEPARATOR)];
  for (const g of gear) {
    const attrs = g.attributes.map(
      (a) => `${GEAR_ATTR_TYPES[a.type]?.label ?? a.type} +${formatNumberDe(a.value)}`,
    );
    lines.push(
      [
        SLOT_LABELS[g.slot],
        g.brand,
        RARITY_LABELS[g.brandType],
        g.prototype ? "ja" : "nein",
        GEAR_CORE_LABELS[g.core],
        attrs[0] ?? "",
        attrs[1] ?? "",
        g.talent ?? "",
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

function parseSlot(label: string): GearSlot {
  const l = label.trim().toLowerCase();
  if (l.startsWith("mask")) return "mask";
  if (l.startsWith("west")) return "chest";
  if (l.startsWith("holster")) return "holster";
  if (l.startsWith("rucksack") || l.startsWith("backpack")) return "backpack";
  if (l.startsWith("handschuh") || l.startsWith("glove")) return "gloves";
  if (l.startsWith("knie")) return "kneepads";
  return "mask";
}

function parseRarity(label: string): GearPiece["brandType"] {
  const l = label.trim().toLowerCase();
  if (l.startsWith("exot") || l === "exotic") return "exotic";
  if (l.startsWith("named")) return "named";
  if (l.includes("gear-set") || l.includes("gearset") || l.includes("set")) return "gearset";
  return "brand";
}

function parseCore(label: string): GearCoreType {
  const l = label.trim().toLowerCase();
  if (l.startsWith("rüstung") || l.startsWith("armor") || l.startsWith("armour")) return "armour";
  if (l.startsWith("skill")) return "skill";
  return "wd";
}

function parseAttr(cell: string): { type: GearAttrKey; value: number } | null {
  const trimmed = cell.trim();
  if (!trimmed) return null;
  for (const [key, cfg] of Object.entries(GEAR_ATTR_TYPES) as [GearAttrKey, { label: string }][]) {
    if (trimmed.toLowerCase().startsWith(cfg.label.toLowerCase().slice(0, 8))) {
      const match = trimmed.match(/([+-]?[\d.,]+)\s*%?$/);
      return { type: key, value: match ? parseGermanNumber(match[1]) : 0 };
    }
  }
  return null;
}

export interface GearCsvImportResult {
  gear: GearPiece[];
  skippedRows: number;
}

export function gearFromCsv(csv: string, makeId: () => string): GearCsvImportResult {
  const text = csv.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { gear: [], skippedRows: 0 };
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const slotIdx = header.findIndex((h) => h.startsWith("slot"));
  const brandIdx = header.findIndex((h) => h.startsWith("marke") || h.startsWith("set"));
  if (slotIdx === -1 || brandIdx === -1) throw new Error("CSV ohne 'Slot'-/Marke-Spalte");

  const col = (needle: string) => header.findIndex((h) => h.startsWith(needle));
  const rarityIdx = col("besonderheit");
  const protoIdx = col("prototyp");
  const coreIdx = col("1. attribut");
  const a2Idx = col("2. attribut");
  const a3Idx = col("3. attribut");
  const talentIdx = col("talent");

  const gear: GearPiece[] = [];
  let skippedRows = 0;
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const brand = (cells[brandIdx] ?? "").trim();
    if (!brand) {
      skippedRows++;
      continue;
    }
    const brandType = rarityIdx >= 0 ? parseRarity(cells[rarityIdx] ?? "") : "brand";
    const isExotic = brandType === "exotic";
    const attrs = [a2Idx, a3Idx]
      .map((i) => (i >= 0 ? parseAttr(cells[i] ?? "") : null))
      .filter((a): a is { type: GearAttrKey; value: number } => a !== null);

    gear.push(
      normalizeGear({
        id: makeId(),
        slot: parseSlot(cells[slotIdx] ?? ""),
        brand,
        brandType,
        core: coreIdx >= 0 ? parseCore(cells[coreIdx] ?? "") : "wd",
        attributes: attrs,
        talent: talentIdx >= 0 && (cells[talentIdx] ?? "").trim() ? (cells[talentIdx] ?? "").trim() : null,
        prototype: protoIdx >= 0
          ? (cells[protoIdx] ?? "").trim().toLowerCase().startsWith("j") && !isExotic
          : !isExotic,
      }),
    );
  }
  return { gear, skippedRows };
}
