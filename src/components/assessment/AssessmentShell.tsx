import { NavBar } from "@/components/NavBar";
import { LanguageSelect } from "@/components/landing/LanguageSelect";
import type { Copy, Lang } from "@/lib/i18n";

// A discriminated union rather than an optional `firstRun?: boolean` on purpose:
// an optional prop that's forgotten at a call site silently defaults to
// `undefined` -> falsy -> the NavBar reappears for a first-run account, and it
// still compiles. Making `firstRun` required whenever `chrome: "nav"` turns
// that mistake into a compile error at every one of the four "nav" call sites
// instead of a bug found by clicking around.
type AssessmentShellProps = { lang: Lang; navCopy: Copy["nav"]; children: React.ReactNode } & (
  | {
      // No nav bar, ever: the check-in is asking you something, and wandering
      // off mid-grid or mid-direction is exactly what this mode prevents.
      chrome: "focus";
    }
  | {
      // Reporting, not asking — results, the directions list, areas, habits
      // review. A RETURNING user (already has a tracked habit, here for the
      // periodic recheck-in) keeps the NavBar, unchanged. A FIRST-RUN user
      // (no tracked habit yet) gets none here either: leaving mid-chain has
      // nowhere real to go yet, and the (app) gate would just bounce them
      // back — better to not offer the door than to open it and slam it.
      chrome: "nav";
      firstRun: boolean;
    }
);

// The frame every onboarding screen sits in.
//
// These routes live outside the (app) group, so they get no layout NavBar and
// have to make the call themselves. The language toggle is rendered here only
// in focus mode: NavBar already carries one, and two would be two.
export function AssessmentShell(props: AssessmentShellProps) {
  const { lang, navCopy, children } = props;
  const showNav = props.chrome === "nav" && !props.firstRun;
  return (
    <>
      {showNav && <NavBar lang={lang} copy={navCopy} />}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-24">
        {props.chrome === "focus" && (
          <div className="flex justify-end mb-4">
            <LanguageSelect current={lang} />
          </div>
        )}
        {children}
      </main>
    </>
  );
}
