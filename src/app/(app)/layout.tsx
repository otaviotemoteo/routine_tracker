import { redirect } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { countTrackedHabits } from "@/db/habits";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import { requireUserId } from "@/lib/session";

// Persistent shell for the authenticated app: the NavBar renders once here and
// survives navigations (no remount / no perceived reload). Login and the
// values check-in live outside this group and get no NavBar.
//
// Onboarding gate: an account with no active habit yet hasn't finished the
// first run, so it's sent into the values check-in — the guided path that
// actually produces habits (values -> priority areas -> directions -> AI
// suggestions -> review -> Start tracking). Derived from the database, not a
// cookie, so it survives a cleared browser or a second device.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await requireUserId();
  const lang = await getLang();
  if ((await countTrackedHabits(userId)) === 0) {
    redirect("/assessment");
  }

  return (
    <>
      <NavBar lang={lang} copy={COPY[lang].nav} />
      {children}
    </>
  );
}
