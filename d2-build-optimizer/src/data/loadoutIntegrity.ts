import type { Loadout, Weapon, GearPiece } from "./sampleData";


export interface LoadoutIntegrity {
  missingWeaponIds: string[];
  missingGearIds: string[];
  changedWeaponIds: string[];
  changedGearIds: string[];
  dbOutdated: boolean;
  outdated: boolean;
  reasons: string[];
}

export function weaponFingerprint(w: Weapon): string {
  return [
    w.type,
    w.rarity,
    w.baseDamage,
    w.rpm,
    w.magSize,
    w.talent,
    w.knowHow,
    w.isPrototype ? 1 : 0,
    w.attributes.core1,
    w.attributes.core2Type ?? "",
    w.attributes.core2Val ?? 0,
    w.attributes.minorType ?? "",
    w.attributes.minorVal ?? 0,
    w.reloadSeconds ?? "",
  ].join("|");
}

export function gearFingerprint(g: GearPiece): string {
  return [
    g.slot,
    g.brand,
    g.brandType,
    g.core,
    g.coreValue,
    g.attributes.map((a) => `${a.type}:${a.value}`).join(","),
    g.talent ?? "",
    g.prototype ? 1 : 0,
    g.mod ? `${g.mod.attr}:${g.mod.value}` : "",
  ].join("|");
}

export function checkLoadoutIntegrity(
  loadout: Loadout,
  weapons: Weapon[],
  gear: GearPiece[],
  currentDbVersion: string,
): LoadoutIntegrity {
  const missingWeaponIds: string[] = [];
  const changedWeaponIds: string[] = [];
  for (const wid of loadout.weaponIds) {
    const w = weapons.find((x) => x.id === wid);
    if (!w) {
      missingWeaponIds.push(wid);
      continue;
    }
    if (loadout.signatures?.[wid] && loadout.signatures[wid] !== weaponFingerprint(w)) {
      changedWeaponIds.push(wid);
    }
  }
  const missingGearIds: string[] = [];
  const changedGearIds: string[] = [];
  for (const gid of Object.values(loadout.gearIds)) {
    if (!gid) continue;
    const g = gear.find((x) => x.id === gid);
    if (!g) {
      missingGearIds.push(gid);
      continue;
    }
    if (loadout.signatures?.[gid] && loadout.signatures[gid] !== gearFingerprint(g)) {
      changedGearIds.push(gid);
    }
  }
  const dbOutdated =
    Boolean(loadout.dbVersion) && loadout.dbVersion !== currentDbVersion;
  const reasons: string[] = [];
  if (missingWeaponIds.length > 0) {
    reasons.push(
      `${missingWeaponIds.length} Waffe(n) nicht mehr im Inventar`,
    );
  }
  if (missingGearIds.length > 0) {
    reasons.push(
      `${missingGearIds.length} Gear-Teil(e) nicht mehr im Inventar`,
    );
  }
  if (changedWeaponIds.length > 0) {
    reasons.push(`${changedWeaponIds.length} Waffe(n) geändert`);
  }
  if (changedGearIds.length > 0) {
    reasons.push(`${changedGearIds.length} Gear-Teil(e) geändert`);
  }
  if (dbOutdated) {
    reasons.push(`Datenbank aktualisiert (${loadout.dbVersion} → ${currentDbVersion})`);
  }
  return {
    missingWeaponIds,
    missingGearIds,
    changedWeaponIds,
    changedGearIds,
    dbOutdated,
    outdated: reasons.length > 0,
    reasons,
  };
}

export interface BuildCode {
  code: string;
  text: string;
}

export function buildCodeFromLoadout(
  loadout: Loadout,
  weapons: Weapon[],
  gear: GearPiece[],
): BuildCode {
  const weaponLines = loadout.weaponIds
    .map((wid) => weapons.find((w) => w.id === wid))
    .filter((w): w is Weapon => Boolean(w))
    .map((w) => `Waffe: ${w.name} (${w.type.toUpperCase()}${w.talent ? ` · ${w.talent}` : ""})`);
  const gearLines = (Object.values(loadout.gearIds) as (string | undefined)[])
    .map((gid) => gear.find((g) => g.id === gid))
    .filter((g): g is GearPiece => Boolean(g))
    .map((g) => `${g.brand} (${g.slot})`);
  const lines = [
    `Loadout: ${loadout.name}`,
    ...weaponLines,
    ...gearLines,
    `DPS: ${Math.round(loadout.metrics.dps).toLocaleString("de-DE")} · CHC: ${loadout.metrics.chc.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % · CHD: +${loadout.metrics.chd.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`,
    `Rolle: ${loadout.roleId} · Stand: ${loadout.timestamp}`,
  ];
  const text = lines.join("\n");
  const payload = JSON.stringify({
    n: loadout.name,
    w: loadout.weaponIds,
    g: loadout.gearIds,
    m: loadout.metrics,
    r: loadout.roleId,
    d: loadout.dbVersion,
  });
  const code = `D2BO-${btoa(unescape(encodeURIComponent(payload)))}`;
  return { code, text };
}
