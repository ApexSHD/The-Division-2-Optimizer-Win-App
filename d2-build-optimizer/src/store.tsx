import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Weapon, GearPiece, Mod, BrandSet, Build, GearSlot } from "./data/sampleData";
import { sampleWeapons, sampleGear, sampleMods, sampleBrandSets, sampleGearSets, sampleBuilds } from "./data/sampleData";
import { getDb } from "./data/db";
import type { Db } from "./data/db";

export type ViewId = "global" | "weapons" | "gear" | "optimizer" | "compare" | "admin" | "settings";
export type Theme = "dark" | "light" | "system";

export interface AgentValues {
  chc: number;
  chd: number;
  wd: number;
}

export interface Profile {
  id: string;
  name: string;
}

export interface UserData {
  schemaVersion: 1;
  profiles: Profile[];
  activeProfileId: string;
  theme: Theme;
  lang: "de" | "en";
  agent: AgentValues;
  weapons: Weapon[];
  gear: GearPiece[];
  builds: Build[];
}

const SCHEMA_VERSION = 1;

export const STANDARD_PROFILE: Profile = { id: "default", name: "Standard" };

function defaultUserData(): UserData {
  return {
    schemaVersion: SCHEMA_VERSION,
    profiles: [STANDARD_PROFILE],
    activeProfileId: STANDARD_PROFILE.id,
    theme: "dark",
    lang: "de",
    agent: { chc: 40, chd: 95, wd: 15 },
    weapons: sampleWeapons,
    gear: sampleGear,
    builds: sampleBuilds,
  };
}

function sanitize(raw: unknown): UserData {
  const fallback = defaultUserData();
  if (typeof raw !== "object" || raw === null) return fallback;
  const r = raw as Partial<UserData>;
  if (!Array.isArray(r.profiles) || r.profiles.length === 0) return fallback;
  return {
    schemaVersion: SCHEMA_VERSION,
    profiles: r.profiles,
    activeProfileId: r.activeProfileId ?? r.profiles[0].id,
    theme: r.theme === "light" || r.theme === "system" ? r.theme : "dark",
    lang: r.lang === "en" ? "en" : "de",
    agent: r.agent ?? fallback.agent,
    weapons: Array.isArray(r.weapons) ? r.weapons : [],
    gear: Array.isArray(r.gear) ? r.gear : [],
    builds: Array.isArray(r.builds) ? r.builds : [],
  };
}

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export interface AppState {
  view: ViewId;
  setView: (v: ViewId) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  lang: "de" | "en";
  setLang: (l: "de" | "en") => void;
  sidebarVisible: boolean;
  toggleSidebar: () => void;
  agent: AgentValues;
  setAgent: (a: AgentValues) => void;
  weapons: Weapon[];
  gear: GearPiece[];
  mods: Mod[];
  brandSets: BrandSet[];
  gearSets: BrandSet[];
  db: Db | null;
  builds: Build[];
  status: string;
  setStatus: (s: string) => void;
  progress: number | null;
  setProgress: (p: number | null) => void;
  addWeapon: (w: Weapon) => void;
  updateWeapon: (w: Weapon) => void;
  removeWeapon: (id: string) => void;
  addGear: (g: GearPiece) => void;
  updateGear: (g: GearPiece) => void;
  removeGear: (id: string) => void;
  profiles: Profile[];
  activeProfileId: string;
  addProfile: (name: string) => void;
  renameProfile: (id: string, name: string) => void;
  removeProfile: (id: string) => void;
  setActiveProfile: (id: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  storagePath: string | null;
  loadError: string | null;
}

export const StoreContext = createContext<AppState | null>(null);

export function useStore(): AppState {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("StoreContext missing provider");
  return ctx;
}

function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<AppState["view"]>("global");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [status, setStatus] = useState("Bereit");
  const [progress, setProgress] = useState<number | null>(null);
  const [userData, setUserData] = useState<UserData>(() => defaultUserData());
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [db, setDb] = useState<Db | null>(null);

  useEffect(() => {
    getDb().then(setDb).catch(() => setDb(null));
  }, []);
  const undoStack = useRef<UserData[]>([]);
  const redoStack = useRef<UserData[]>([]);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (restored) return;
    setRestored(true);
    if (!isTauri) return;
    (async () => {
      try {
        const raw = await tauriInvoke<string | null>("load_user_data");
        if (raw !== null) {
          setUserData(sanitize(JSON.parse(raw)));
          setStatus("Benutzerdaten geladen");
        } else {
          setStatus("Neue Benutzerdatenbank angelegt");
        }
        const dir = await tauriInvoke<string>("data_dir");
        setStoragePath(dir);
      } catch (e) {
        setLoadError(String(e));
        setStatus("Fehler beim Laden der Benutzerdaten");
      }
    })();
  }, [restored]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isTauri || !restored) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      tauriInvoke("save_user_data", { json: JSON.stringify(userData, null, 2) }).catch((e) => {
        setStatus(`Speichern fehlgeschlagen: ${e}`);
      });
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [userData, restored]);

  const mutate = useCallback((fn: (d: UserData) => UserData) => {
    setUserData((current) => {
      undoStack.current = [...undoStack.current.slice(-99), current];
      redoStack.current = [];
      setUndoDepth(undoStack.current.length);
      setRedoDepth(0);
      return fn(current);
    });
  }, []);

  const undo = useCallback(() => {
    setUserData((current) => {
      const prev = undoStack.current.pop();
      if (!prev) return current;
      redoStack.current = [...redoStack.current, current];
      setUndoDepth(undoStack.current.length);
      setRedoDepth(redoStack.current.length);
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setUserData((current) => {
      const next = redoStack.current.pop();
      if (!next) return current;
      undoStack.current = [...undoStack.current, current];
      setUndoDepth(undoStack.current.length);
      setRedoDepth(redoStack.current.length);
      return next;
    });
  }, []);

  const setTheme = useCallback((th: Theme) => {
    setUserData((d) => ({ ...d, theme: th }));
  }, []);

  const setLang = useCallback((l: "de" | "en") => {
    setUserData((d) => ({ ...d, lang: l }));
  }, []);

  const value: AppState = {
    view,
    setView,
    theme: userData.theme,
    setTheme,
    lang: userData.lang,
    setLang,
    sidebarVisible,
    toggleSidebar: () => setSidebarVisible((v) => !v),
    agent: userData.agent,
    setAgent: (a) => mutate((d) => ({ ...d, agent: a })),
    weapons: userData.weapons,
    gear: userData.gear,
    mods: db?.mods.map((m) => ({
      id: m.name,
      category: (m.slot as Mod["category"]) ?? "optic",
      compat: m.slotTypes,
      value: [m.bonus, m.penalty].filter(Boolean).join(" · "),
    })) ?? sampleMods,
    brandSets: (db?.brandSets ?? sampleBrandSets.map((b) => ({ ...b, key: b.id }))).map((b) => ({
      id: b.key,
      name: b.name,
      bonuses: b.bonuses,
    })),
    gearSets: (db?.gearSets ?? sampleGearSets.map((b) => ({ ...b, key: b.id }))).map((b) => ({
      id: b.key,
      name: b.name,
      bonuses: b.bonuses,
    })),
    db,
    builds: userData.builds,
    status,
    setStatus,
    progress,
    setProgress,
    addWeapon: (w) => mutate((d) => ({ ...d, weapons: [...d.weapons, w] })),
    updateWeapon: (w) =>
      mutate((d) => ({ ...d, weapons: d.weapons.map((x) => (x.id === w.id ? w : x)) })),
    removeWeapon: (id) =>
      mutate((d) => ({
        ...d,
        weapons: d.weapons.filter((x) => x.id !== id),
        builds: d.builds.map((b) => ({ ...b, weaponIds: b.weaponIds.filter((wid) => wid !== id) })),
      })),
    addGear: (g) => mutate((d) => ({ ...d, gear: [...d.gear, g] })),
    updateGear: (g) =>
      mutate((d) => ({ ...d, gear: d.gear.map((x) => (x.id === g.id ? g : x)) })),
    removeGear: (id) =>
      mutate((d) => ({
        ...d,
        gear: d.gear.filter((x) => x.id !== id),
        builds: d.builds.map((b) => {
          const gearIds = { ...b.gearIds };
          for (const slot of Object.keys(gearIds) as GearSlot[]) {
            if (gearIds[slot] === id) delete gearIds[slot];
          }
          return { ...b, gearIds };
        }),
      })),
    profiles: userData.profiles,
    activeProfileId: userData.activeProfileId,
    addProfile: (name) =>
      mutate((d) => {
        const p = { id: newId("p"), name: name.trim() || "Profil" };
        return { ...d, profiles: [...d.profiles, p], activeProfileId: p.id };
      }),
    renameProfile: (id, name) =>
      mutate((d) => ({
        ...d,
        profiles: d.profiles.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)),
      })),
    removeProfile: (id) =>
      mutate((d) => {
        if (d.profiles.length <= 1) return d;
        const profiles = d.profiles.filter((p) => p.id !== id);
        const activeProfileId = d.activeProfileId === id ? profiles[0].id : d.activeProfileId;
        return { ...d, profiles, activeProfileId };
      }),
    setActiveProfile: (id) => mutate((d) => ({ ...d, activeProfileId: id })),
    canUndo: undoDepth > 0,
    canRedo: redoDepth > 0,
    undo,
    redo,
    storagePath,
    loadError,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
