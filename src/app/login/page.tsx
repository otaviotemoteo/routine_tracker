import type { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LoginForm } from "@/components/landing/LoginForm";

export const metadata: Metadata = {
  title: "Entrar — Tracker",
};

// The landing page: short pitch on top, login right below (the single action
// of the page), how-it-works last. Single-user app — no marketing fluff.
export default function LoginPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 pb-24">
      <Hero />
      <LoginForm />
      <HowItWorks />
    </main>
  );
}
