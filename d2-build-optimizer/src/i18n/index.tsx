import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { de, type Translation } from "./de";
import { en } from "./en";
import { useStore } from "../store";

export type Language = "de" | "en";

const dictionaries: Record<Language, Translation> = { de, en };

type I18nContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translation;
};

export const I18nContext = createContext<I18nContextValue>({
  lang: "de",
  setLang: () => undefined,
  t: de,
});

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const value: I18nContextValue = {
    lang: store.lang,
    setLang: store.setLang,
    t: dictionaries[store.lang] ?? de,
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
