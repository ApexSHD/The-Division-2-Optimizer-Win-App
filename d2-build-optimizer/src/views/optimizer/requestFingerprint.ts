import type { OptimizerRequest } from "../../store";
import type { Weapon, GearPiece } from "../../data/sampleData";
import { weaponFingerprint, gearFingerprint } from "../../data/loadoutIntegrity";

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

/** Fingerprint aus Auftrag + Inventar — ändert sich bei jeder relevanten Änderung (OP-1.5 „veraltet“). */
export function optimizerFingerprint(
  req: OptimizerRequest,
  weapons: Weapon[],
  gear: GearPiece[],
): string {
  const reqPart = stableStringify(req);
  const invPart = stableStringify({
    w: weapons.map((w) => weaponFingerprint(w)),
    g: gear.map((g) => gearFingerprint(g)),
  });
  return `${reqPart.length}:${invPart.length}:${simpleHash(reqPart + "|" + invPart)}`;
}

function simpleHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
