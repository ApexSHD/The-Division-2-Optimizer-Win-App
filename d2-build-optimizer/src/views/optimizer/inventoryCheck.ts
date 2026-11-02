import { ROLE_PROFILES, type RoleProfile } from "../../data/roleProfiles";
import type { GearPiece, Weapon } from "../../data/sampleData";

export type RoleFeasibility = "possible" | "limited" | "impossible";

export interface RoleCheck {
  roleKey: string;
  name: string;
  feasibility: RoleFeasibility;
  reason: string;
}

export interface InventoryCheck {
  gearCount: number;
  weaponCount: number;
  missingWeaponTypes: string[];
  hasPistol: boolean;
  coreCounts: { wd: number; armour: number; skill: number };
  roles: RoleCheck[];
}

const WEAPON_TYPE_LABELS: Record<string, string> = {
  ar: "Sturmgewehr",
  smg: "MP",
  lmg: "LMG",
  rifle: "Gewehr",
  mmr: "MMR",
  shotgun: "Schrotflinte",
  pistol: "Pistole",
};

const ALL_TYPES = ["ar", "smg", "lmg", "rifle", "mmr", "shotgun", "pistol"];

function feasibilityOf(role: RoleProfile, gear: GearPiece[], weapons: Weapon[]): RoleCheck {
  const coreCount = (core: string) => gear.filter((g) => g.core === core).length;
  const wd = coreCount("wd");
  const armour = coreCount("armour");
  const skill = coreCount("skill");
  const missing: string[] = [];
  for (const m of role.minima) {
    if (m.kind === "cores") {
      const have = m.core === "wd" ? wd : m.core === "armour" ? armour : skill;
      if (have < m.min) {
        missing.push(
          m.core === "armour"
            ? `${m.min - have} blaue Kern(e) fehlen`
            : m.core === "skill"
              ? `${m.min - have} gelbe Kern(e) fehlen`
              : `${m.min - have} rote Kern(e) fehlen`,
        );
      }
    }
    if (m.kind === "chc" && gear.length > 0) {
      const chc = gear.reduce((s, g) => s + g.attributes.filter((a) => a.type === "chc").reduce((x, a) => x + a.value, 0), 0);
      if (chc + 10 < m.min) missing.push(`CHC ${Math.round(chc + 10)} % < Ziel ${m.min} % (inkl. SHD-Uhr)`);
    }
  }
  const exoticGear = gear.filter((g) => g.brandType === "exotic").length;
  if (weapons.filter((w) => w.rarity === "exotic").length === 0 && role.minima.some((m) => m.kind === "chc")) {
    // kein harter Ausschluss, nur Hinweis
  }
  if (exoticGear < 1 && gear.length > 0) {
    // Exotic-Gear ist nicht Pflicht — kein Ausschluss
  }
  const feasibility: RoleFeasibility =
    missing.length === 0 ? "possible" : missing.some((m) => m.includes("Kern")) ? "impossible" : missing.length <= 2 ? "limited" : "impossible";
  return {
    roleKey: role.key,
    name: role.name,
    feasibility,
    reason: missing.length > 0 ? missing.join("; ") : "alle Mindestwerte erreichbar",
  };
}

export function computeInventoryCheck(gear: GearPiece[], weapons: Weapon[]): InventoryCheck {
  const present = new Set(weapons.map((w) => w.type));
  const missingWeaponTypes = ALL_TYPES.filter((t) => !present.has(t as never));
  const coreCounts = {
    wd: gear.filter((g) => g.core === "wd").length,
    armour: gear.filter((g) => g.core === "armour").length,
    skill: gear.filter((g) => g.core === "skill").length,
  };
  return {
    gearCount: gear.length,
    weaponCount: weapons.length,
    missingWeaponTypes: missingWeaponTypes.map((t) => WEAPON_TYPE_LABELS[t] ?? t),
    hasPistol: present.has("pistol"),
    coreCounts,
    roles: ROLE_PROFILES.map((r) => feasibilityOf(r, gear, weapons)),
  };
}
