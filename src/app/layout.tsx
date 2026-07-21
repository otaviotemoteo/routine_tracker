import type { Metadata, Viewport } from "next";
import { Fraunces, Jost, JetBrains_Mono } from "next/font/google";
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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
