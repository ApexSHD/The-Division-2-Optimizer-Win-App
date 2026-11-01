import type { GearPiece, GearSlot, GearCoreType, Weapon, WeaponType, Loadout } from "./sampleData";
import {
  GEAR_ATTR_TYPES,
  gearAttrMax,
  gearCoreMax,
  weaponAttrMax,
  WEAPON_CORE1_MAX,
  WEAPON_CORE2_BY_TYPE,
  WEAPON_MINOR_MAX,
} from "./sampleData";
import type { GearAttrKey } from "./sampleData";
import { SOURCES, type SourceEntry } from "./v4Data";
import { computeInventoryKpis } from "./dashboardData";
import { normalizeAxes, roleProfile, scoreBuild } from "./roleProfiles";
import { axisContextFor, optimizeV4, defaultSetBonusCatalog, type ModeContext, V4_ALL_SLOTS } from "./operatingModes";
import { computeEffectVector, vectorToRecord } from "./axes";
import { enemyProfileFromSettings, evaluateBuild } from "./damage";
import type { AxisKey } from "./v4Data";

export const ANALYSIS_SLOTS: GearSlot[] = ["mask", "chest", "holster", "backpack", "gloves", "kneepads"];
export const ANALYSIS_WEAPON_TYPES: WeaponType[] = ["ar", "smg", "lmg", "rifle", "mmr", "shotgun", "pistol"];
export const TOP_ROLL_THRESHOLD = 0.9;

export type CoreColor = "rot" | "blau" | "gelb";
export const CORE_COLOR_OF: Record<GearCoreType, CoreColor> = { wd: "rot", armour: "blau", skill: "gelb" };

export interface SlotCoreCell {
  slot: GearSlot;
  rot: number;
  blau: number;
  gelb: number;
}

export interface RarityCounts {
  highend: number;
  gearset: number;
  named: number;
  exotic: number;
}

export interface RollQualityClass {
  label: "top" | "mid" | "low";
  count: number;
}

export interface GearRollQuality {
  pieceId: string;
  slot: GearSlot;
  brand: string;
  ratio: number;
  klass: "top" | "mid" | "low";
}

export interface WeaponFamily {
  name: string;
  count: number;
  weaponIds: string[];
}

export interface WeaponTypeCoverage {
  type: WeaponType;
  count: number;
  bestWeaponId: string | null;
}

export interface SetProgressEntry {
  key: string;
  name: string;
  kind: "brand" | "gearset";
  pieces: number;
  slots: GearSlot[];
  reachedBonuses: { pieces: number; bonus: string }[];
}

export interface SetConflict {
  a: string;
  b: string;
  sharedSlots: GearSlot[];
}

export interface Insight {
  id: string;
  severity: "warning" | "info";
  text: string;
  tab: AnalysisTabId;
}

export type AnalysisTabId = "overview" | "gear" | "weapons" | "sets" | "gaps" | "cleanup";

export interface DuplicateGroup {
  key: string;
  pieceIds: string[];
}

export interface DominatedPart {
  pieceId: string;
  dominatesPieceId: string;
  slot: GearSlot;
  reason: string;
}

export interface CleanupCandidate {
  pieceId: string;
  kind: "duplicate" | "dominated" | "unused";
  reason: string;
  keepMarked: boolean;
}

export interface HealthBreakdown {
  slotCoverage: number;
  coreColors: number;
  weaponTypes: number;
  rollQuality: number;
  setCoverage: number;
  total: number;
}

export interface GapRecommendationEntry {
  rank: number;
  slot: GearSlot;
  targetName: string;
  targetBrand: string;
  gainPercent: number | null;
  gainScore: number;
  source: SourceEntry;
  stage: "A" | "B";
}

export interface RoleReachability {
  roleId: string;
  reachabilityPercent: number | null;
}

export interface InventoryAnalysis {
  analyzedAt: string;
  gearTotal: number;
  weaponTotal: number;
  prototypeShare: number;
  gearRarity: RarityCounts;
  weaponRarity: RarityCounts;
  slotCoreMatrix: SlotCoreCell[];
  coreTotals: Record<CoreColor, number>;
  brandCounts: { name: string; count: number; slots: GearSlot[] }[];
  gearsetCounts: { name: string; count: number; slots: GearSlot[] }[];
  rollQuality: GearRollQuality[];
  rollQualityClasses: RollQualityClass[];
  attrDistribution: { attr: GearAttrKey; count: number }[];
  missingAttrs: GearAttrKey[];
  bestAndWorstPerSlot: { slot: GearSlot; bestId: string | null; worstId: string | null }[];
  exoticGearCount: number;
  dataQualityIssues: string[];
  weaponTypeCoverage: WeaponTypeCoverage[];
  weaponFamilies: WeaponFamily[];
  talentCounts: { talent: string; count: number }[];
  weaponRollQuality: { weaponId: string; ratio: number; klass: "top" | "mid" | "low" }[];
  setProgress: SetProgressEntry[];
  setConflicts: SetConflict[];
  exoticLimitViolation: boolean;
  unusedGearIds: string[];
  unusedWeaponIds: string[];
  duplicateGroups: DuplicateGroup[];
  dominated: DominatedPart[];
  cleanupCandidates: CleanupCandidate[];
  insights: Insight[];
  health: HealthBreakdown;
  reachabilityByRole: RoleReachability[];
  gapRecommendations: GapRecommendationEntry[];
  noteUpgradeExcluded: boolean;
}

export interface InventoryAnalysisInput {
  gear: GearPiece[];
  weapons: Weapon[];
  builds: Loadout[];
  roleId?: string;
  ctx?: ModeContext;
  fullGear?: GearPiece[];
  keepMarkedIds?: string[];
  analyzedAt?: string;
  zielWeaponsSameAsInventar?: boolean;
  onProgress?: (phase: string, done: number, total: number) => void;
  shouldAbort?: () => boolean;
}

function rollClass(ratio: number): "top" | "mid" | "low" {
  if (ratio >= TOP_ROLL_THRESHOLD) return "top";
  if (ratio >= 0.7) return "mid";
  return "low";
}

export function gearRollRatio(g: GearPiece): number {
  const coreMax = gearCoreMax(g.core, g.prototype);
  const parts: number[] = [];
  if (coreMax > 0) parts.push(Math.min(1, g.coreValue / coreMax));
  for (const a of g.attributes) {
    const max = gearAttrMax(a.type, g.prototype);
    if (max && max > 0) parts.push(a.value / max);
  }
  if (parts.length === 0) return 0;
  return parts.reduce((s, x) => s + x, 0) / parts.length;
}

export function weaponRollRatio(w: Weapon): number {
  const parts: number[] = [];
  parts.push(w.attributes.core1 / weaponAttrMax(WEAPON_CORE1_MAX, w.isPrototype));
  const core2Max = WEAPON_CORE2_BY_TYPE[w.type]?.max ?? WEAPON_MINOR_MAX.dttooc;
  parts.push(w.attributes.core2Val / weaponAttrMax(core2Max, w.isPrototype));
  parts.push(
    w.attributes.minorVal / weaponAttrMax(WEAPON_MINOR_MAX[w.attributes.minorType] ?? WEAPON_MINOR_MAX.dttooc, w.isPrototype),
  );
  return parts.reduce((s, x) => s + x, 0) / parts.length;
}

function weaponScore(w: Weapon, metric: "dps" | "sustained" | "dmgMag"): number {
  const dps = (w.baseDamage * w.rpm) / 60;
  const sustained = w.magSize > 0 && w.reloadSeconds ? (w.baseDamage * w.magSize) / (w.magSize / w.rpm / 60 + (w.reloadSeconds ?? 0)) : dps;
  const dmgMag = w.baseDamage * w.magSize;
  return metric === "dps" ? dps : metric === "sustained" ? sustained : dmgMag;
}

export function sourceForItem(itemName: string): SourceEntry {
  const lower = itemName.toLowerCase();
  const direct = SOURCES.find((s) => s.item.toLowerCase().includes(lower) || lower.includes(s.item.toLowerCase()));
  if (direct) return direct;
  const firstWord = lower.split(/[\s(]/)[0];
  const byWord = SOURCES.find((s) => s.item.toLowerCase().split(/[\s(]/)[0] === firstWord && firstWord.length > 2);
  if (byWord) return byWord;
  return SOURCES.find((s) => s.source_type === "targeted_farm") ?? SOURCES[0];
}

function sameFingerprint(a: GearPiece, b: GearPiece): boolean {
  if (a.slot !== b.slot || a.brand !== b.brand || a.core !== b.core || a.talent !== b.talent) return false;
  const attrsA = a.attributes.map((x) => `${x.type}:${x.value}`).sort().join("|");
  const attrsB = b.attributes.map((x) => `${x.type}:${x.value}`).sort().join("|");
  return attrsA === attrsB && a.coreValue === b.coreValue;
}

function dominates(a: GearPiece, b: GearPiece): boolean {
  if (a.id === b.id || a.slot !== b.slot || a.brand !== b.brand || (a.talent ?? "") !== (b.talent ?? "")) return false;
  const mapB = new Map(b.attributes.map((x) => [x.type, x.value]));
  let strictlyBetter = false;
  if (a.coreValue < b.coreValue) return false;
  if (a.coreValue > b.coreValue) strictlyBetter = true;
  for (const attr of a.attributes) {
    const bv = mapB.get(attr.type);
    if (bv === undefined || attr.value < bv) return false;
    if (attr.value > bv) strictlyBetter = true;
  }
  return strictlyBetter;
}

export function analyzeInventory(input: InventoryAnalysisInput): InventoryAnalysis {
  const { gear, weapons, builds } = input;
  const keepMarked = new Set(input.keepMarkedIds ?? []);
  const analyzedAt = input.analyzedAt ?? new Date().toISOString();

  const kpis = computeInventoryKpis(gear, weapons, builds);

  const gearRarity: RarityCounts = {
    highend: gear.filter((g) => g.brandType === "brand").length,
    gearset: gear.filter((g) => g.brandType === "gearset").length,
    named: gear.filter((g) => g.brandType === "named").length,
    exotic: gear.filter((g) => g.brandType === "exotic").length,
  };
  const weaponRarity: RarityCounts = {
    highend: weapons.filter((w) => w.rarity === "highend").length,
    gearset: 0,
    named: weapons.filter((w) => w.rarity === "named").length,
    exotic: weapons.filter((w) => w.rarity === "exotic").length,
  };

  const slotCoreMatrix: SlotCoreCell[] = ANALYSIS_SLOTS.map((slot) => ({
    slot,
    rot: gear.filter((g) => g.slot === slot && g.core === "wd").length,
    blau: gear.filter((g) => g.slot === slot && g.core === "armour").length,
    gelb: gear.filter((g) => g.slot === slot && g.core === "skill").length,
  }));
  const coreTotals: Record<CoreColor, number> = {
    rot: gear.filter((g) => g.core === "wd").length,
    blau: gear.filter((g) => g.core === "armour").length,
    gelb: gear.filter((g) => g.core === "skill").length,
  };

  const groupByBrand = (kind: "brand" | "gearset") => {
    const map = new Map<string, GearSlot[]>();
    for (const g of gear) {
      if (g.brandType !== kind) continue;
      const list = map.get(g.brand) ?? [];
      list.push(g.slot);
      map.set(g.brand, list);
    }
    return [...map.entries()]
      .map(([name, slots]) => ({ name, count: slots.length, slots }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"));
  };

  const rollQuality: GearRollQuality[] = gear
    .map((g) => {
      const ratio = gearRollRatio(g);
      return { pieceId: g.id, slot: g.slot, brand: g.brand, ratio, klass: rollClass(ratio) };
    })
    .sort((a, b) => b.ratio - a.ratio);
  const classCounts = { top: 0, mid: 0, low: 0 };
  for (const r of rollQuality) classCounts[r.klass]++;
  const rollQualityClasses: RollQualityClass[] = [
    { label: "top", count: classCounts.top },
    { label: "mid", count: classCounts.mid },
    { label: "low", count: classCounts.low },
  ];

  const attrCounts = new Map<GearAttrKey, number>();
  for (const g of gear) for (const a of g.attributes) attrCounts.set(a.type, (attrCounts.get(a.type) ?? 0) + 1);
  const attrDistribution = [...attrCounts.entries()]
    .map(([attr, count]) => ({ attr, count }))
    .sort((a, b) => b.count - a.count);
  const allGearAttrs = Object.keys(GEAR_ATTR_TYPES) as GearAttrKey[];
  const missingAttrs = allGearAttrs.filter((a) => !attrCounts.has(a));

  const bestAndWorstPerSlot = ANALYSIS_SLOTS.map((slot) => {
    const inSlot = rollQuality.filter((r) => r.slot === slot);
    return {
      slot,
      bestId: inSlot[0]?.pieceId ?? null,
      worstId: inSlot.length > 0 ? inSlot[inSlot.length - 1].pieceId : null,
    };
  });

  const exoticGearCount = gearRarity.exotic;
  const dataQualityIssues: string[] = [];
  for (const g of gear) {
    for (const a of g.attributes) {
      const max = gearAttrMax(a.type, g.prototype);
      if (max && a.value > max) {
        dataQualityIssues.push(`${g.brand} (${g.slot}): ${GEAR_ATTR_TYPES[a.type]?.label ?? a.type} ${a.value} > Max ${max}`);
      }
      if (!GEAR_ATTR_TYPES[a.type]) {
        dataQualityIssues.push(`${g.brand} (${g.slot}): unbekanntes Attribut „${a.type}“`);
      }
    }
    if (!g.brand.trim()) dataQualityIssues.push(`Teil ohne Marke/Set in Slot ${g.slot}`);
  }

  const weaponTypeCoverage: WeaponTypeCoverage[] = ANALYSIS_WEAPON_TYPES.map((type) => {
    const inType = weapons.filter((w) => w.type === type);
    const best = [...inType].sort((a, b) => weaponScore(b, "dps") - weaponScore(a, "dps"))[0] ?? null;
    return { type, count: inType.length, bestWeaponId: best?.id ?? null };
  });

  const familyMap = new Map<string, Weapon[]>();
  for (const w of weapons) {
    const list = familyMap.get(w.name) ?? [];
    list.push(w);
    familyMap.set(w.name, list);
  }
  const weaponFamilies: WeaponFamily[] = [...familyMap.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([name, list]) => ({ name, count: list.length, weaponIds: list.map((w) => w.id) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"));

  const talentMap = new Map<string, number>();
  for (const w of weapons) {
    if (!w.talent.trim()) continue;
    talentMap.set(w.talent, (talentMap.get(w.talent) ?? 0) + 1);
  }
  const talentCounts = [...talentMap.entries()]
    .map(([talent, count]) => ({ talent, count }))
    .sort((a, b) => b.count - a.count);

  const weaponRollQuality = weapons
    .map((w) => {
      const ratio = weaponRollRatio(w);
      return { weaponId: w.id, ratio, klass: rollClass(ratio) };
    })
    .sort((a, b) => b.ratio - a.ratio);

  const setProgress: SetProgressEntry[] = [...groupByBrand("gearset"), ...groupByBrand("brand")].map((entry) => {
    const kind = gear.find((g) => g.brand === entry.name)?.brandType === "gearset" ? "gearset" : "brand";
    const reachedBonuses = [2, 3, 4]
      .filter((pieces) => entry.count >= pieces)
      .map((pieces) => ({ pieces, bonus: `${pieces}er-Bonus aktiv` }));
    return {
      key: entry.name,
      name: entry.name,
      kind,
      pieces: entry.count,
      slots: entry.slots,
      reachedBonuses,
    };
  });

  const setConflicts: SetConflict[] = [];
  const allSets = setProgress.filter((s) => s.pieces >= 2);
  for (let i = 0; i < allSets.length; i++) {
    for (let j = i + 1; j < allSets.length; j++) {
      const shared = allSets[i].slots.filter((s) => allSets[j].slots.includes(s));
      if (shared.length >= 4) {
        setConflicts.push({ a: allSets[i].name, b: allSets[j].name, sharedSlots: shared });
      }
    }
  }

  const usedGearIds = new Set<string>();
  const usedWeaponIds = new Set<string>();
  for (const b of builds) {
    for (const gid of Object.values(b.gearIds)) if (gid) usedGearIds.add(gid);
    for (const wid of b.weaponIds) usedWeaponIds.add(wid);
  }
  const unusedGearIds = gear.filter((g) => !usedGearIds.has(g.id)).map((g) => g.id);
  const unusedWeaponIds = weapons.filter((w) => !usedWeaponIds.has(w.id)).map((w) => w.id);

  const duplicateGroups: DuplicateGroup[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < gear.length; i++) {
    if (seen.has(gear[i].id)) continue;
    const group = gear.filter((g) => sameFingerprint(g, gear[i]));
    if (group.length > 1) {
      duplicateGroups.push({ key: `${group[0].slot}:${group[0].brand}`, pieceIds: group.map((g) => g.id) });
      group.forEach((g) => seen.add(g.id));
    }
  }

  const dominated: DominatedPart[] = [];
  for (const b of gear) {
    for (const a of gear) {
      if (dominates(a, b)) {
        dominated.push({
          pieceId: b.id,
          dominatesPieceId: a.id,
          slot: b.slot,
          reason: `${a.brand} ist in allen Attributen mindestens gleich gut und in mindestens einem besser`,
        });
      }
    }
  }

  const rollById = new Map(rollQuality.map((r) => [r.pieceId, r]));
  const cleanupCandidates: CleanupCandidate[] = [
    ...duplicateGroups.flatMap((grp) =>
      grp.pieceIds.slice(1).map((id) => ({
        pieceId: id,
        kind: "duplicate" as const,
        reason: `Exaktes Duplikat von ${grp.pieceIds[0]} (${grp.key})`,
        keepMarked: keepMarked.has(id),
      })),
    ),
    ...dominated.map((d) => ({
      pieceId: d.pieceId,
      kind: "dominated" as const,
      reason: `Dominiert: ${d.reason}`,
      keepMarked: keepMarked.has(d.pieceId),
    })),
    ...unusedGearIds
      .filter((id) => (rollById.get(id)?.ratio ?? 0) < 0.7)
      .map((id) => ({
        pieceId: id,
        kind: "unused" as const,
        reason: "In keinem Build verwendet und Roll-Qualität < 70 %",
        keepMarked: keepMarked.has(id),
      })),
  ].filter((c) => !c.keepMarked);

  const insights: Insight[] = [];
  const emptyHealth: HealthBreakdown = {
    slotCoverage: 0,
    coreColors: 0,
    weaponTypes: 0,
    rollQuality: 0,
    setCoverage: 0,
    total: 0,
  };
  if (gear.length === 0 && weapons.length === 0) {
    return {
      analyzedAt,
      gearTotal: 0,
      weaponTotal: 0,
      prototypeShare: 0,
      gearRarity: { highend: 0, gearset: 0, named: 0, exotic: 0 },
      weaponRarity: { highend: 0, gearset: 0, named: 0, exotic: 0 },
      slotCoreMatrix,
      coreTotals,
      brandCounts: [],
      gearsetCounts: [],
      rollQuality: [],
      rollQualityClasses: [
        { label: "top", count: 0 },
        { label: "mid", count: 0 },
        { label: "low", count: 0 },
      ],
      attrDistribution: [],
      missingAttrs: allGearAttrs,
      bestAndWorstPerSlot,
      exoticGearCount: 0,
      dataQualityIssues: [],
      weaponTypeCoverage,
      weaponFamilies: [],
      talentCounts: [],
      weaponRollQuality: [],
      setProgress: [],
      setConflicts: [],
      exoticLimitViolation: false,
      unusedGearIds: [],
      unusedWeaponIds: [],
      duplicateGroups: [],
      dominated: [],
      cleanupCandidates: [],
      insights: [],
      health: emptyHealth,
      reachabilityByRole: [],
      gapRecommendations: [],
      noteUpgradeExcluded: true,
    };
  }
  if (coreTotals.blau === 0 && coreTotals.gelb === 0) {
    insights.push({ id: "no-blue-yellow-core", severity: "warning", text: "Kein Teil mit Rüstungs- oder Skill-Tier-Kern (blau/gelb)", tab: "gear" });
  }
  const missingWeaponTypes = weaponTypeCoverage.filter((c) => c.count === 0).map((c) => c.type);
  if (missingWeaponTypes.length > 0) {
    const labels = missingWeaponTypes.map((t) => WEAPON_TYPE_LABELS[t]).join(", ");
    insights.push({ id: "missing-weapon-types", severity: "warning", text: `Keine Waffen vom Typ: ${labels}`, tab: "weapons" });
  }
  for (const c of setConflicts) {
    insights.push({
      id: `conflict-${c.a}-${c.b}`,
      severity: "info",
      text: `${c.a} und ${c.b} belegen dieselben Slots (${c.sharedSlots.join(", ")}) und sind nicht gleichzeitig mit vollem Bonus tragbar`,
      tab: "sets",
    });
  }
  if (exoticGearCount > 1) {
    const names = gear.filter((g) => g.brandType === "exotic").map((g) => g.brand).join(", ");
    insights.push({ id: "exotic-limit", severity: "warning", text: `${exoticGearCount} exotische Gear-Teile vorhanden (${names}) – es darf nur eines getragen werden`, tab: "sets" });
  }
  if (talentCounts.length > 0 && talentCounts[0].count >= Math.max(3, weapons.length / 3)) {
    insights.push({ id: "talent-monotony", severity: "info", text: `Talent „${talentCounts[0].talent}“ kommt ${talentCounts[0].count}× vor – geringe Talent-Vielfalt`, tab: "weapons" });
  }
  insights.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "warning" ? -1 : 1));

  const slotCoverage = ANALYSIS_SLOTS.filter((s) => gear.some((g) => g.slot === s)).length / ANALYSIS_SLOTS.length;
  const coreColors = (coreTotals.rot > 0 ? 1 : 0) + (coreTotals.blau > 0 ? 1 : 0) + (coreTotals.gelb > 0 ? 1 : 0);
  const weaponTypes = ANALYSIS_WEAPON_TYPES.filter((t) => weapons.some((w) => w.type === t)).length / ANALYSIS_WEAPON_TYPES.length;
  const avgRoll = gear.length > 0 ? rollQuality.reduce((s, r) => s + r.ratio, 0) / gear.length : 0;
  const setCoverage = setProgress.filter((s) => s.pieces >= 2).length > 0 ? 1 : 0;
  const healthParts = {
    slotCoverage: slotCoverage * 20,
    coreColors: (coreColors / 3) * 20,
    weaponTypes: weaponTypes * 20,
    rollQuality: avgRoll * 25,
    setCoverage: setCoverage * 15,
  };
  const health: HealthBreakdown = { ...healthParts, total: Math.round(Object.values(healthParts).reduce((s, x) => s + x, 0)) };

  const reachabilityByRole: RoleReachability[] = [];
  const gapRecommendations: GapRecommendationEntry[] = [];
  if (input.ctx && weapons.length > 0 && gear.length > 0) {
    const ctx = input.ctx;
    const profileRoleKeys = ["dps_krit", "skill_schaden", "kontrolle", "tank"];
    const profileKeys: string[] = input.roleId ? [profileRoleKeyFor(input.roleId)] : profileRoleKeys;
    const fullGear = input.fullGear ?? dbGearPool(gear);
    for (const roleKey of profileKeys) {
      const role = roleProfile(roleKey);
      const inv = optimizeV4(weapons, gear, { ...ctx, roleKey, mode: "inventar" }, { maxResults: 50, budgetPerSlot: 25, beamWidth: 4000, onProgress: input.onProgress, shouldAbort: input.shouldAbort });
      if (input.shouldAbort?.()) break;
      const invTopWeapon = inv.candidates[0]?.weapon ?? weapons[0];
      const zielWeapons = input.zielWeaponsSameAsInventar === false ? weapons : [invTopWeapon];
      const ziel = optimizeV4(zielWeapons, fullGear, { ...ctx, roleKey, mode: "ziel" }, { maxResults: 50, budgetPerSlot: 25, beamWidth: 4000, onProgress: input.onProgress, shouldAbort: input.shouldAbort });
      if (input.shouldAbort?.()) break;
      const invBest = inv.best ?? inv.ranked[0] ?? null;
      const zielBest = ziel.best ?? ziel.ranked[0] ?? null;
      void zielBest;
      const invScore = invBest?.score ?? null;
      const zielScore = ziel.ranked[0]?.score ?? null;
      const pct = invScore !== null && zielScore !== null && zielScore > 0 ? (100 * invScore) / zielScore : null;
      reachabilityByRole.push({ roleId: roleKey, reachabilityPercent: pct === null ? null : Math.round(pct * 10) / 10 });

      if (roleKey === profileRoleKeyFor(input.roleId || "dps_krit") && inv.candidates.length > 0 && ziel.candidates.length > 0) {
        const invCand = (invBest && inv.candidates.find((c) => c.id === invBest.id)) || inv.candidates[0];
        const zielCand = (zielBest && ziel.candidates.find((c) => c.id === zielBest.id)) || ziel.candidates[0];
        if (invCand && zielCand) {
          const zielBySlot = new Map(zielCand.gear.map((g) => [g.slot, g]));
          const invWeaponId = invCand.weapon.id;
          const invVecs = inv.candidates.filter((c) => c.weapon.id === invWeaponId).map((c) => vectorToRecord(c.vector));
          const zielVecs = ziel.candidates.filter((c) => c.weapon.id === invWeaponId).map((c) => vectorToRecord(c.vector));
          const hybridVectors: Record<AxisKey, number>[] = [];
          const slots: GearSlot[] = [];
          const ideals: GearPiece[] = [];
          for (const slot of V4_ALL_SLOTS) {
            const current = invCand.gear.find((g) => g.slot === slot);
            const ideal = zielBySlot.get(slot);
            if (!ideal || !current || current.id === ideal.id) continue;
            const withIdeal = invCand.gear.map((g) => (g.slot === slot ? ideal : g));
            const { damage: hybridDamage } = evaluateBuild(invCand.weapon, withIdeal, {
              shdLevel: ctx.shdLevel,
              profile: enemyProfileFromSettings(ctx.settings),
              spec: ctx.spec,
              setBonusCatalog: defaultSetBonusCatalog(),
            });
            const hybridDps = ctx.settings.targetMetric === "burst" ? hybridDamage.effectiveDps : hybridDamage.sustainedDps;
            const v = computeEffectVector(axisContextFor(withIdeal, hybridDps, ctx, role));
            hybridVectors.push(vectorToRecord(v));
            slots.push(slot);
            ideals.push(ideal);
          }
          const allVectors = [
            ...zielVecs,
            ...invVecs,
            ...hybridVectors,
            vectorToRecord(invCand.vector),
          ];
          const normalized = normalizeAxes(allVectors);
          const invScoreNorm = scoreBuild(role, normalized[normalized.length - 1]);
          const entries: GapRecommendationEntry[] = [];
          for (let i = 0; i < slots.length; i++) {
            const hybridIdx = zielVecs.length + invVecs.length + i;
            const gainScore = scoreBuild(role, normalized[hybridIdx]) - invScoreNorm;
            if (!Number.isFinite(gainScore) || gainScore <= 1e-9) continue;
            const gainPercent = invScoreNorm > 0 ? (100 * gainScore) / invScoreNorm : null;
            const src = sourceForItem(ideals[i].brand);
            entries.push({
              rank: 0,
              slot: slots[i],
              targetName: ideals[i].brand,
              targetBrand: ideals[i].brand,
              gainPercent: gainPercent === null ? null : Math.round(gainPercent * 10) / 10,
              gainScore: Math.round(gainScore * 100) / 100,
              source: src,
              stage: src.stage,
            });
          }
          entries.sort((a, b) => (b.gainPercent ?? -1) - (a.gainPercent ?? -1));
          entries.forEach((e, i) => {
            e.rank = i + 1;
          });
          gapRecommendations.push(...entries);
        }
      }
    }
  }

  return {
    analyzedAt,
    gearTotal: kpis.gearTotal,
    weaponTotal: kpis.weaponTotal,
    prototypeShare: gear.length > 0 ? gear.filter((g) => g.prototype).length / gear.length : 0,
    gearRarity,
    weaponRarity,
    slotCoreMatrix,
    coreTotals,
    brandCounts: groupByBrand("brand"),
    gearsetCounts: groupByBrand("gearset"),
    rollQuality,
    rollQualityClasses,
    attrDistribution,
    missingAttrs,
    bestAndWorstPerSlot,
    exoticGearCount,
    dataQualityIssues,
    weaponTypeCoverage,
    weaponFamilies,
    talentCounts,
    weaponRollQuality,
    setProgress,
    setConflicts,
    exoticLimitViolation: exoticGearCount > 1,
    unusedGearIds,
    unusedWeaponIds,
    duplicateGroups,
    dominated,
    cleanupCandidates,
    insights: insights.slice(0, 5),
    health,
    reachabilityByRole,
    gapRecommendations,
    noteUpgradeExcluded: true,
  };
}

import gearJson from "../db/gear.json";
import { SLOT_DE_LABELS } from "./db";

function profileRoleKeyFor(roleId: string | undefined): string {
  return roleId || "dps_krit";
}

/**
 * Ziel-Pool für die Lückenanalyse: das komplette Gear aus der Spiel-Datenbank
 * (gear.json), damit „Ziel-Build“ nicht durch das eigene Inventar begrenzt ist.
 */
export function dbGearPool(owned: GearPiece[]): GearPiece[] {
  const db = gearJson as unknown as {
    gear_db: Record<string, {
      slot: string;
      brand: string;
      cls: "named" | "exotic";
      proto?: boolean;
      core: string;
      fixed: (string | number)[][];
      perk?: string;
    }>;
    green_set_info: Record<string, { name?: string }>;
    brand_set_info: Record<string, { name?: string }>;
  };
  const pool: GearPiece[] = Object.entries(db.gear_db).map(([name, g], i) => {
    const slot = SLOT_DE_LABELS[g.slot] ?? "mask";
    const core = g.core === "armour" ? "armour" : g.core === "skill" ? "skill" : "wd";
    return {
      id: `dbpool-${i}`,
      slot,
      brand: g.brand || name,
      brandType: g.cls === "exotic" ? "exotic" : "named",
      core,
      coreValue: core === "wd" ? 22.5 : core === "armour" ? 170000 : 1.5,
      attributes: [
        ...(g.fixed ?? []).map(([k, v]) => ({ type: String(k) as GearAttrKey, value: Number(v) })),
        ...(core === "wd" ? [{ type: "chc" as GearAttrKey, value: 10 }, { type: "chd" as GearAttrKey, value: 12 }] : []),
        ...(core === "armour" ? [{ type: "health" as GearAttrKey, value: 18935 }] : []),
        ...(core === "skill" ? [{ type: "skilldmg" as GearAttrKey, value: 10 }, { type: "skillhaste" as GearAttrKey, value: 12 }] : []),
      ],
      talent: g.perk ?? null,
      prototype: g.proto ?? false,
      mod: null,
    };
  });
  let synthIdx = 0;
  const synthIdeal = (brand: string, brandType: "gearset" | "brand", slot: GearSlot): GearPiece => ({
    id: `dbsynth-${synthIdx++}`,
    slot,
    brand,
    brandType,
    core: "wd",
    coreValue: 22.5,
    attributes: [
      { type: "chc" as GearAttrKey, value: 10 },
      { type: "chd" as GearAttrKey, value: 12 },
    ],
    talent: null,
    prototype: true,
    mod: null,
  });
  for (const info of Object.values(db.green_set_info ?? {})) {
    const name = info.name ?? "";
    if (!name) continue;
    for (const slot of ANALYSIS_SLOTS) pool.push(synthIdeal(name, "gearset", slot));
  }
  for (const info of Object.values(db.brand_set_info ?? {})) {
    const name = info.name ?? "";
    if (!name) continue;
    for (const slot of ANALYSIS_SLOTS) pool.push(synthIdeal(name, "brand", slot));
  }
  void owned;
  return pool;
}

const WEAPON_TYPE_LABELS: Record<WeaponType, string> = {
  ar: "Sturmgewehr",
  smg: "MP",
  lmg: "LMG",
  rifle: "Gewehr",
  mmr: "MMR",
  shotgun: "Schrotflinte",
  pistol: "Pistole",
};

export { weaponScore, WEAPON_TYPE_LABELS };
