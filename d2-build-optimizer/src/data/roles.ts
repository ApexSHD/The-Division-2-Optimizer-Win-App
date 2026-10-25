import type { OptimizationSettings } from "../store";

export type RoleId = "weaponDps" | "skillBurst" | "statusCc" | "tankRegen";

export interface RolePreset {
  id: RoleId;
  icon: string;
  labelDe: string;
  labelEn: string;
  descDe: string;
  descEn: string;
  patch: Partial<OptimizationSettings>;
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    id: "weaponDps",
    icon: "💥",
    labelDe: "All-Out Weapon DPS",
    labelEn: "All-Out Weapon DPS",
    descDe: "Striker-Plattform mit hoher Krit-Rate, maximale Waffenschaden-Cores.",
    descEn: "Striker platform with high crit rate, maximum weapon damage cores.",
    patch: { targetChc: 60, requiredChest: false, requiredBackpack: false },
  },
  {
    id: "skillBurst",
    icon: "🤖",
    labelDe: "Skill Burst / Explosiv",
    labelEn: "Skill Burst / Explosive",
    descDe: "Turret & Drone mit maximalem Skill-Tier und Skill-Schaden.",
    descEn: "Turret & Drone with maximum skill tiers and skill damage.",
    patch: { targetChc: 10 },
  },
  {
    id: "statusCc",
    icon: "😵",
    labelDe: "Status-Effekt / CC",
    labelEn: "Status Effect / CC",
    descDe: "Blinding / Vile-Mask-Setup mit Status-Stärke.",
    descEn: "Blinding / Vile Mask setup with status power.",
    patch: { targetChc: 30 },
  },
  {
    id: "tankRegen",
    icon: "🛡️",
    labelDe: "Tank / Regeneration",
    labelEn: "Tank / Regeneration",
    descDe: "Armor-Regen & defensive Werte statt Schaden.",
    descEn: "Armor regen and defensive values instead of damage.",
    patch: { targetChc: 10, enemyArmorShare: 80, enemyHealthShare: 20 },
  },
];

export function rolePreset(id: RoleId): RolePreset {
  return ROLE_PRESETS.find((r) => r.id === id) ?? ROLE_PRESETS[0];
}
