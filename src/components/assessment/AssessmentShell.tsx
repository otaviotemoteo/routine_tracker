import { NavBar } from "@/components/NavBar";
import { LanguageSelect } from "@/components/landing/LanguageSelect";
import type { Copy, Lang } from "@/lib/i18n";

interface AssessmentShellProps {
  lang: Lang;
  navCopy: Copy["nav"];
  // "focus" while the check-in is asking you something: no nav bar, because
  // wandering off mid-grid is exactly what the flow is protecting against.
  // "nav" once it is reporting — results and the directions list are places
  // you visit, not steps you are inside, so the rest of the app stays reachable.
  chrome: "focus" | "nav";
  children: React.ReactNode;
}

// The frame every assessment screen sits in.
//
// These routes live outside the (app) group, so they get no layout NavBar and
// have to make the call themselves. The language toggle is rendered here only
// in focus mode: NavBar already carries one, and two would be two.
export function AssessmentShell({
  lang,
  navCopy,
  chrome,
  children,
}: AssessmentShellProps) {
  return (
    <>
      {chrome === "nav" && <NavBar lang={lang} copy={navCopy} />}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-24">
        {chrome === "focus" && (
          <div className="flex justify-end mb-4">
            <LanguageSelect current={lang} />
          </div>
        )}
        {children}
      </main>
    </>
  );
}
