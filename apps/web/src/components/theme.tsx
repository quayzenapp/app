"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Look = "pencil" | "pro";
export type ThemeChoice = "light" | "dark" | "system";
type Ctx = { look: Look; dark: boolean; setLook: (l: Look) => void; toggleDark: () => void };
const ThemeCtx = createContext<Ctx>({ look: "pencil", dark: false, setLook: () => {}, toggleDark: () => {} });
export const useTheme = () => useContext(ThemeCtx);
const save = (k: string, v: string) => { document.cookie = `${k}=${v};path=/;max-age=31536000;samesite=lax`; };

export function ThemeProvider({ look: initialLook, choice, children }: { look: Look; choice: ThemeChoice; children: React.ReactNode }) {
  const [look, setLookState] = useState(initialLook);
  const [dark, setDark] = useState(choice === "dark");
  useEffect(() => {
    if (choice !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setDark(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [choice]);
  useEffect(() => {
    const h = document.documentElement;
    h.dataset.look = look; h.dataset.dark = dark ? "1" : "0"; h.dataset.theme = dark ? "dark" : "light";
  }, [look, dark]);
  const setLook = useCallback((l: Look) => { setLookState(l); save("qz_look", l); }, []);
  const toggleDark = useCallback(() => setDark((d) => { save("qz_theme", d ? "light" : "dark"); return !d; }), []);
  return <ThemeCtx.Provider value={{ look, dark, setLook, toggleDark }}>{children}</ThemeCtx.Provider>;
}

/** The only way to render a pack icon: picks one of the four packs from the current mode. */
export function Pic({ name, className = "" }: { name: string; className?: string }) {
  const { look, dark } = useTheme();
  const pack = `${look === "pro" ? "professional" : "pencil"}-${dark ? "dark" : "light"}`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`pic ${className}`} src={`/icons/${pack}/${name}.svg`} alt="" draggable={false} />;
}

export function HeroArt() {
  const { dark } = useTheme();
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="hero-art" src={`/illustrations/sez-waterfront-${dark ? "dark" : "light"}.svg`} alt="Pencil drawing of Port City Colombo" />;
}
