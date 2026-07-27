import { NavBar } from "@/components/NavBar";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";

// Persistent shell for the authenticated app: the NavBar renders once here and
// survives navigations (no remount / no perceived reload). Login and onboarding
// live outside this group and get no NavBar.
// (The onboarding-gate redirect is added in Phase 9, once the wizard and the
// entity tables it checks against exist.)
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getLang();
  return (
    <>
      <NavBar lang={lang} copy={COPY[lang].nav} />
      {children}
    </>
  );
}
