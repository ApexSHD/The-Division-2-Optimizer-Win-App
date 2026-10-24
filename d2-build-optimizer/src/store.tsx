import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { sampleWeapons, sampleGear, sampleMods, sampleBrandSets, sampleGearSets, sampleBuilds } from "./data/sampleData";

export type ViewId = "global" | "weapons" | "gear" | "optimizer" | "compare" | "admin" | "settings";
export type Theme = "dark" | "light" | "system";

export interface AgentValues {
  chc: number;
  chd: number;
  wd: number;
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
  weapons: typeof sampleWeapons;
  gear: typeof sampleGear;
  mods: typeof sampleMods;
  brandSets: typeof sampleBrandSets;
  gearSets: typeof sampleGearSets;
  builds: typeof sampleBuilds;
  status: string;
  setStatus: (s: string) => void;
  progress: number | null;
  setProgress: (p: number | null) => void;
}

export const StoreContext = createContext<AppState | null>(null);

export function useStore(): AppState {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("StoreContext missing provider");
  return ctx;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<AppState["view"]>("global");
  const [theme, setTheme] = useState<AppState["theme"]>("dark");
  const [lang, setLang] = useState<"de" | "en">("de");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [agent, setAgent] = useState<AgentValues>({ chc: 40, chd: 95, wd: 15 });
  const [status, setStatus] = useState("Bereit");
  const [progress, setProgress] = useState<number | null>(null);

  const value: AppState = {
    view,
    setView,
    theme,
    setTheme,
    lang,
    setLang,
    sidebarVisible,
    toggleSidebar: () => setSidebarVisible((v) => !v),
    agent,
    setAgent,
    weapons: sampleWeapons,
    gear: sampleGear,
    mods: sampleMods,
    brandSets: sampleBrandSets,
    gearSets: sampleGearSets,
    builds: sampleBuilds,
    status,
    setStatus,
    progress,
    setProgress,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
