import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { isConfigured } from "@/db/queries";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import { ONBOARDED_COOKIE } from "@/lib/onboarding";

// Persistent shell for the authenticated app: the NavBar renders once here and
// survives navigations (no remount / no perceived reload). Login and onboarding
// live outside this group and get no NavBar.
//
// Onboarding gate: on first visit with nothing configured, send the user to the
// wizard. The `onboarded` cookie short-circuits the DB check afterwards, so a
// user who intentionally skipped everything isn't nagged again.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getLang();
  const onboarded = (await cookies()).get(ONBOARDED_COOKIE)?.value === "1";
  if (!onboarded && !(await isConfigured())) {
    redirect("/onboarding");
  }

  return (
    <>
      <NavBar lang={lang} copy={COPY[lang].nav} />
      {children}
    </>
  );
}
