import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SezWording } from "@/components/sez-wording";
import { ThemeProvider, type Look, type ThemeChoice } from "@/components/theme";
import "./globals.css";

export const metadata: Metadata = { title: "Quayzen", description: "SEZ records, deadlines and filings in one place." };
const FONTS = "https://fonts.googleapis.com/css2?family=Google+Sans:wght@400..700&family=Poppins:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=Patrick+Hand&display=swap";
// Resolves "system" before first paint so there is no flash of the wrong theme.
const PREPAINT = `try{var h=document.documentElement,t=h.dataset.choice,d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);h.dataset.dark=d?"1":"0";h.dataset.theme=d?"dark":"light"}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const c = await cookies();
  const look = (c.get("qz_look")?.value === "pro" ? "pro" : "pencil") as Look;
  const v = c.get("qz_theme")?.value;
  const choice = (v === "light" || v === "dark" ? v : "system") as ThemeChoice;
  const dark = choice === "dark";
  return (
    <html lang="en" data-look={look} data-choice={choice} data-theme={dark ? "dark" : "light"} data-dark={dark ? "1" : "0"} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
        <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />
      </head>
      <body>
        {/* The artifact's hand-drawn effect for Pencil charts. */}
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true"><filter id="qz-wobble" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="4" result="t" /><feDisplacementMap in="SourceGraphic" in2="t" scale="2.6" xChannelSelector="R" yChannelSelector="G" /></filter></svg>
        <ThemeProvider look={look} choice={choice}>{children}</ThemeProvider><SezWording />
      </body>
    </html>
  );
}
