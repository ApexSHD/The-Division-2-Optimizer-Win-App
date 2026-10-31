import aliasesJson from "../db/aliases.json";

type AliasTable = Record<string, string[]>;

interface AliasFile {
  brands: AliasTable;
  gearsets: AliasTable;
  talents: AliasTable;
}

const ALIASES = aliasesJson as unknown as AliasFile;

export type AliasCategory = "brands" | "gearsets" | "talents";

const normalizedIndex = new Map<AliasCategory, Map<string, string>>();

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

for (const [category, table] of Object.entries(ALIASES) as [AliasCategory, AliasTable][]) {
  const index = new Map<string, string>();
  for (const [canonical, aliasList] of Object.entries(table)) {
    for (const name of [canonical, ...aliasList]) {
      index.set(normalizeName(name), canonical);
    }
  }
  normalizedIndex.set(category, index);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 3) return Infinity;
  const prev = new Array<number>(n + 1);
  const cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j];
  }
  return prev[n];
}

export interface AliasResolution {
  original: string;
  canonical: string;
  suggestionUsed: boolean;
}

export function resolveNameAlias(
  name: string,
  category: AliasCategory,
): AliasResolution {
  const index = normalizedIndex.get(category);
  if (!index) return { original: name, canonical: name, suggestionUsed: false };
  const normalized = normalizeName(name);
  if (!normalized) return { original: name, canonical: name, suggestionUsed: false };
  const exact = index.get(normalized);
  if (exact) return { original: name, canonical: exact, suggestionUsed: false };
  let best: { canonical: string; distance: number } | null = null;
  for (const [alias, canonical] of index) {
    const distance = levenshtein(normalized, alias);
    if (distance === Infinity) continue;
    const tolerance = Math.max(1, Math.floor(alias.length / 4));
    if (distance <= tolerance && (!best || distance < best.distance)) {
      best = { canonical, distance };
    }
  }
  if (best) return { original: name, canonical: best.canonical, suggestionUsed: true };
  return { original: name, canonical: name, suggestionUsed: false };
}
