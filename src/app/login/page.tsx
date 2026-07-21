import type { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LoginForm } from "@/components/landing/LoginForm";
import { LanguageSelect } from "@/components/landing/LanguageSelect";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${COPY[lang].landing.loginHeading} — Tracker` };
}

// The landing page: short pitch on top, login right below (the single action
// of the page), how-it-works last. Single-user app — no marketing fluff.
export default async function LoginPage() {
  const lang = await getLang();
  const copy = COPY[lang].landing;

  return (
    <main className="max-w-3xl mx-auto px-6 pb-24">
      <div className="flex justify-end pt-4">
        <LanguageSelect current={lang} />
      </div>
      <div className="flex flex-col items-center">
        <Hero copy={copy} />
        <LoginForm copy={copy} />
      </div>
      <HowItWorks copy={copy} />
    </main>
  );
}
