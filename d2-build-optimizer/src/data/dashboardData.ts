import type { GearPiece, GearAttrKey, Loadout, Weapon, GearSlot } from "./sampleData";
import { GEAR_ATTR_TYPES, gearAttrMax, RELOAD_SECONDS_BY_TYPE } from "./sampleData";

export interface SlotSummary {
  slot: GearSlot;
  count: number;
  cores: { rot: number; blau: number; gelb: number };
}

export interface QualityMetric {
  attr: GearAttrKey;
  label: string;
  topCount: number;
  thresholdPercent: number;
}

export interface InventoryKpis {
  gearTotal: number;
  weaponTotal: number;
  exoticGear: number;
  exoticWeapons: number;
  gearsets: { name: string; count: number }[];
  brands: { name: string; count: number }[];
  slots: SlotSummary[];
  topParts: QualityMetric[];
  zeroUsageGearIds: string[];
  zeroUsageWeaponIds: string[];
}

export interface RoleKing {
  roleId: string;
  roleLabel: string;
  loadout: Loadout | null;
}

export interface DistributionValues {
  armor: number;
  skill: number;
  weaponDamage: number;
}

export interface BuildTip {
  kind: "tip" | "talent";
  text: string;
}

export const ROLE_LABELS: Record<string, string> = {
  dps_krit: "DPS Krit",
  dps_kopf: "DPS Kopfschuss",
  skill_heiler: "Skill-Heiler",
  skill_supporter: "Skill-Support",
  armor_tank: "Rüstungs-Tank",
  hybrid_schaden_skill: "Hybrid Schaden/Skill",
  hybrid_schaden_tank: "Hybrid Schaden/Tank",
  hybrid_skill_tank: "Hybrid Skill/Tank",
};

const TIPS: string[] = [
  "Kritische Trefferchance ist auf 60 % gedeckelt — Werte darüber verschenken nichts, werden aber nicht voll genutzt.",
  "Abgestufte Boni (z. B. CHD) lohnen sich erst, wenn CHC über ~40 % liegt — sonst lieber auf WD setzen.",
  "Dauer-DPS berücksichtigt Nachladezeit: Waffen mit kleinem Magazin verlieren im Ranking, wenn du lange Kämpfe spielst.",
  "Exotic-Limit: nur ein exotisches Gear-Teil pro Build — prüfe, ob das Exotic wirklich mehr bringt als ein Marken-Bonus.",
  "Gear-Mods werden als Max-Roll angenommen — die tatsächlichen Werte findest du im Annahmen-Panel des Ergebnisses.",
  "Prototyp-Teile rollen höhere Maxima — im Import als „Prototyp = ja“ kennzeichnen, sonst werden die Max-Werte zu niedrig angenommen.",
  "Für Kopfschuss-Rollen braucht das Gegnerprofil einen Kopfschuss-Anteil > 0 % — der Optimierer fragt beim Rollenwechsel nach.",
];

export function computeInventoryKpis(
  gear: GearPiece[],
  weapons: Weapon[],
  loadouts: Loadout[],
): InventoryKpis {
  const slots: SlotSummary[] = (["mask", "chest", "holster", "backpack", "gloves", "kneepads"] as GearSlot[]).map(
    (slot) => ({
      slot,
      count: gear.filter((g) => g.slot === slot).length,
      cores: {
        rot: gear.filter((g) => g.slot === slot && g.core === "wd").length,
        blau: gear.filter((g) => g.slot === slot && g.core === "armour").length,
        gelb: gear.filter((g) => g.slot === slot && g.core === "skill").length,
      },
    }),
  );

  const gearsetCounts = new Map<string, number>();
  const brandCounts = new Map<string, number>();
  for (const g of gear) {
    if (g.brandType === "gearset") {
      gearsetCounts.set(g.brand, (gearsetCounts.get(g.brand) ?? 0) + 1);
    } else if (g.brandType === "brand") {
      brandCounts.set(g.brand, (brandCounts.get(g.brand) ?? 0) + 1);
    }
  }
  const byCountDesc = (a: { count: number }, b: { count: number }) => b.count - a.count;

  const usedGearIds = new Set<string>();
  const usedWeaponIds = new Set<string>();
  for (const l of loadouts) {
    for (const gid of Object.values(l.gearIds)) {
      if (gid) usedGearIds.add(gid);
    }
    for (const wid of l.weaponIds) usedWeaponIds.add(wid);
  }

  const topParts: QualityMetric[] = [];
  const thresholdPercent = 90;
  const attrTotals = new Map<GearAttrKey, number>();
  for (const g of gear) {
    for (const a of g.attributes) {
      const max = gearAttrMax(a.type, g.prototype);
      if (max && a.value >= (thresholdPercent / 100) * max) {
        attrTotals.set(a.type, (attrTotals.get(a.type) ?? 0) + 1);
      }
    }
  }
  const relevantAttrs: GearAttrKey[] = ["chc", "chd", "hsd", "wd"];
  for (const attr of relevantAttrs) {
    const count = attrTotals.get(attr) ?? 0;
    if (count > 0) {
      topParts.push({
        attr,
        label: GEAR_ATTR_TYPES[attr].label,
        topCount: count,
        thresholdPercent,
      });
    }
  }
  topParts.sort((a, b) => b.topCount - a.topCount);

  return {
    gearTotal: gear.length,
    weaponTotal: weapons.length,
    exoticGear: gear.filter((g) => g.brandType === "exotic").length,
    exoticWeapons: weapons.filter((w) => w.rarity === "exotic").length,
    gearsets: [...gearsetCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort(byCountDesc),
    brands: [...brandCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort(byCountDesc),
    slots,
    topParts,
    zeroUsageGearIds: gear.filter((g) => !usedGearIds.has(g.id)).map((g) => g.id),
    zeroUsageWeaponIds: weapons.filter((w) => !usedWeaponIds.has(w.id)).map((w) => w.id),
  };
}

export function roleKings(loadouts: Loadout[]): RoleKing[] {
  const roleIds = new Set(loadouts.map((l) => l.roleId));
  const result: RoleKing[] = [];
  for (const roleId of roleIds) {
    const best = loadouts
      .filter((l) => l.roleId === roleId)
      .sort((a, b) => b.metrics.dps - a.metrics.dps)[0];
    result.push({
      roleId,
      roleLabel: ROLE_LABELS[roleId] ?? roleId,
      loadout: best ?? null,
    });
  }
  result.sort((a, b) => (b.loadout?.metrics.dps ?? 0) - (a.loadout?.metrics.dps ?? 0));
  return result;
}

export function distributionOverLoadouts(loadouts: Loadout[]): DistributionValues[] {
  return loadouts.map((l) => ({
    armor: l.metrics.armor,
    skill: l.metrics.chc,
    weaponDamage: l.metrics.wd,
  }));
}

export function randomBuildTip(gear: GearPiece[], seed: number): BuildTip {
  const talents = gear
    .map((g) => g.talent)
    .filter((t): t is string => Boolean(t));
  const useTalent = talents.length > 0 && seed % 2 === 0;
  if (useTalent) {
    const talent = talents[seed % talents.length];
    return {
      kind: "talent",
      text: `Aus deinem Inventar: Talent „${talent}" — prüfe im Optimierer, ob es in deinem aktiven Build steckt.`,
    };
  }
  return { kind: "tip", text: TIPS[seed % TIPS.length] };
}

export function reloadHintForType(type: keyof typeof RELOAD_SECONDS_BY_TYPE): string {
  const seconds = RELOAD_SECONDS_BY_TYPE[type];
  return `Nachladezeit-Standard für diese Waffengattung: ${seconds.toLocaleString("de-DE", { maximumFractionDigits: 1 })} s`;
}
