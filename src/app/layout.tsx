import type { Metadata, Viewport } from "next";
import { Fraunces, Jost, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getLang } from "@/lib/get-lang";
import { COPY, htmlLang } from "@/lib/i18n";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-fraunces",
  display: "swap",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const copy = COPY[lang];
  return {
    title: copy.metaTitle,
    description: copy.landing.lead,
  };
}

export const viewport: Viewport = {
  themeColor: "#F7F3E8",
  // Without this, iOS Safari never extends the viewport into the safe-area
  // regions at all, and env(safe-area-inset-bottom) (globals.css's body
  // rule) just evaluates to 0 — the meta tag is what turns the CSS value on.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getLang();

  return (
    <html
      lang={htmlLang(lang)}
      className={`${fraunces.variable} ${jost.variable} ${jetbrains.variable}`}
    >
      <body suppressHydrationWarning>
        {children}
        {/* Page views and Core Web Vitals, both first-party through Vercel.
            They record the ROUTE and never its query string, which matters
            here: `?domain=family` would say which part of somebody's life they
            were looking at, and that is the kind of thing this app collects
            nothing of. Neither sets a cookie or fingerprints a visitor.

            Both are inert unless enabled in the Vercel project, so they cost
            nothing locally and nothing on a fork. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
