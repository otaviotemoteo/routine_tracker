import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { countTrackedHabits } from "@/db/habits";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import { onboardingStepHref, resolveOnboardingStep } from "@/lib/onboarding-flow";
import { requireUserId } from "@/lib/session";

// Paths inside (app) that stay reachable while the resolver says "habits" —
// adding or editing a PROPOSED habit from the review screen. /habits/new and
// /habits/[id] are shared with the fully-onboarded /habits list too, so they
// can't move into /onboarding themselves, but they're exactly as much a part
// of "reviewing your habits" as /onboarding/habits itself is, and blocking
// them would silently break "Add" and "Edit" on that screen the same way the
// review screen itself was silently unreachable before this fix.
function isHabitsReviewSubpath(pathname: string): boolean {
  return pathname === "/habits/new" || /^\/habits\/\d+$/.test(pathname);
}

// Persistent shell for the authenticated app: the NavBar renders once here and
// survives navigations (no remount / no perceived reload). Login and the
// values check-in live outside this group and get no NavBar.
//
// Onboarding gate: an account with no active habit yet hasn't finished the
// first run, so it's sent to wherever resolveOnboardingStep() says it really
// is in that chain (values -> priority areas -> directions -> AI suggestions
// -> review -> Start tracking) — not a single hardcoded route. Derived from
// the database, not a cookie, so it survives a cleared browser or a second
// device.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await requireUserId();
  const lang = await getLang();

  // Whether the NavBar shows at all — not just whether we redirect. The one
  // exempt path (adding/editing a proposed habit mid-review) still means
  // onboarding isn't finished, so it gets the same no-NavBar treatment as
  // every other first-run screen; only the redirect is what's being skipped.
  let showNav = true;
  if ((await countTrackedHabits(userId)) === 0) {
    const resolved = await resolveOnboardingStep(userId);
    const pathname = (await headers()).get("x-pathname") ?? "";
    const exempt = resolved.screen === "habits" && isHabitsReviewSubpath(pathname);
    if (!exempt) {
      redirect(onboardingStepHref(resolved));
    }
    showNav = false;
  }

  return (
    <>
      {showNav && <NavBar lang={lang} copy={COPY[lang].nav} />}
      {children}
    </>
  );
}
