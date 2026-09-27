"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { Locale } from "@/lib/domain";
const Context = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (en: string, es: string) => string;
}>({ locale: "en", setLocale: () => {}, t: (en) => en });
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    try {
      if (localStorage.getItem("language") === "es") setLocale("es");
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem("language", locale);
    } catch {}
  }, [locale]);
  return (
    <Context.Provider
      value={{ locale, setLocale, t: (en, es) => (locale === "en" ? en : es) }}
    >
      {children}
    </Context.Provider>
  );
}
export const useLanguage = () => useContext(Context);
