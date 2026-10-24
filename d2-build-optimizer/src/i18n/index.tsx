import { createContext } from "react";
import type { ReactNode } from "react";
import { de, type Translation } from "./de";
import { en } from "./en";

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

export function I18nProvider({
  lang,
  setLang,
  children,
}: {
  lang: Language;
  setLang: (lang: Language) => void;
  children: ReactNode;
}) {
  const value: I18nContextValue = {
    lang,
    setLang,
    t: dictionaries[lang] ?? de,
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
