import Link from "next/link";
import { ListChecks } from "lucide-react";
import { HabitCard } from "@/components/HabitCard";
import { TodayStats } from "@/components/today/TodayStats";
import { dailyStepHref } from "@/lib/daily";
import type { Copy, Lang } from "@/lib/i18n";
import type { ReadingPace } from "@/lib/today-card";
import type { PaceValues } from "@/lib/setup-summary";
import type { TodayComparisons } from "@/db/queries";
import { EMPTY_ACTIVITY_CONTEXT, type CheckWithActivity, type TodayContext } from "@/types/habit";

interface TodayBoardProps {
  checks: CheckWithActivity[];
  context: TodayContext;
  title: string;
  eyebrow: string;
  streak: number;
  today: string;
  comparisons: TodayComparisons;
  lang: Lang;
  copy: Copy["today"];
  dailyCopy: Copy["daily"];
  readingCopy: Copy["onboarding"]["reading"];
  pace?: ReadingPace;
  paceValues?: PaceValues;
  // The first-run template-chooser invite (src/components/today/TemplatesNudge.tsx),
  // handed in already-built rather than built here — the cookie check that
  // decides whether to show it at all belongs to the page, not the board.
  // Rendered in the same gap-5 flow as the progress card and the grid, so it
  // reads as one more section of a working Today rather than an announcement
  // stacked above one.
  templatesNudge?: React.ReactNode;
  // BUG-2: the ids the nudge above is already speaking for — their default
  // cards must not ALSO render in the grid below, or the same "not set up
  // yet" fact shows twice, once as an offer and once as a blank card. Still
  // counted in the progress math (they're real, trackable habits, just
  // visually deferred to the nudge) — only the grid excludes them.
  hideFromGrid?: ReadonlySet<number>;
}

// Today is a status board: the day in two figures, a progress bar, one call to
// action, and a card per habit. No controls on the cards, so the whole screen
// is server-rendered.
export function TodayBoard({
  checks,
  context,
  title,
  eyebrow,
  streak,
  today,
  comparisons,
  lang,
  copy,
  dailyCopy,
  readingCopy,
  pace,
  paceValues,
  templatesNudge,
  hideFromGrid,
}: TodayBoardProps) {
  const required = checks.filter((c) => !c.optional);
  const doneCount = required.filter((c) => c.done).length;
  const percent =
    required.length === 0 ? 0 : Math.round((doneCount / required.length) * 100);
  const allDone = required.length > 0 && doneCount === required.length;
  // Progress across every habit (optional included) decides the CTA: the
  // optional Hobby still counts as "something logged today".
  const anyLogged = checks.some((c) => c.done);
  const allLogged = checks.every((c) => c.done);

  // A brand-new account tracks nothing yet — habits come out of the values
  // check-in rather than from a seed. Show what to do and link straight to it,
  // instead of an empty grid with a progress bar reading 0%: a bar with no
  // habits behind it is a number the data can't support.
  if (checks.length === 0) {
    return (
      <>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display-title text-4xl sm:text-5xl mt-2 mb-6">{title}</h1>
        <div className="bg-white border-2 border-forest rounded-card shadow-hard px-6 py-8 text-center">
          <h2 className="display-title text-2xl">{copy.emptyTitle}</h2>
          <p className="mt-2 opacity-75 max-w-prose mx-auto">{copy.emptyLead}</p>
          <Link
            href="/habits"
            className="mt-6 min-h-[52px] inline-flex items-center justify-center gap-2 px-7 rounded-full border-2 border-forest bg-clover text-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm"
          >
            <ListChecks aria-hidden className="w-5 h-5" />
            {copy.emptyAction}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div className="min-w-0">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display-title text-4xl sm:text-5xl mt-2">{title}</h1>
        </div>
        <TodayStats
          done={doneCount}
          total={required.length}
          streak={streak}
          copy={copy}
        />
      </div>

      <div className="flex flex-col gap-5">
        <section
          aria-label={copy.progressAria}
          className="bg-white border-2 border-forest rounded-card shadow-hard px-5 py-4"
        >
          <div className="flex justify-between items-baseline font-semibold mb-2.5">
            <span>{allDone ? copy.dayComplete : copy.progress}</span>
            <span className="font-mono font-bold text-sm">
              {doneCount}/{required.length} · {percent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={required.length}
            aria-label={copy.progressAria}
            className="h-4 border-2 border-forest rounded-full bg-sand overflow-hidden"
          >
            <div
              className={`h-full bg-clover transition-[width] duration-300 ${
                percent > 0 && percent < 100 ? "border-r-2 border-forest" : ""
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          {!allDone && (
            <p className="text-sm opacity-75 mt-2.5">{copy.fillHint}</p>
          )}
        </section>

        {/* Nothing logged yet → walk the whole flow. Once something is in,
            the index is the faster way to whatever is left. */}
        <Link
          href={anyLogged ? "/day" : dailyStepHref(checks[0].slug)}
          className="min-h-[52px] inline-flex items-center justify-center gap-2 px-7 rounded-full border-2 border-forest bg-clover text-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm"
        >
          <ListChecks aria-hidden className="w-5 h-5" />
          {!anyLogged
            ? dailyCopy.start
            : allLogged
              ? dailyCopy.review
              : dailyCopy.startRemaining}
        </Link>

        {templatesNudge}

        {/* A fixed row height, not 1fr: the card is a fixed frame that shows as
            much as it can hold, so a habit with a long list can't stretch every
            other card on the board. 250px columns keep this to two inside
            max-w-3xl — at three, a name like "Espiritualidade" has no room left
            beside its status pill. */}
        <ul
          className="grid gap-3.5 sm:gap-4 list-none"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gridAutoRows: "320px",
          }}
        >
          {checks
            .filter((check) => !hideFromGrid?.has(check.id))
            .map((check) => (
              <li key={check.id} className="contents">
                <HabitCard
                  check={check}
                  context={context.activities[check.activityId] ?? EMPTY_ACTIVITY_CONTEXT}
                  lang={lang}
                  copy={copy}
                  readingCopy={readingCopy}
                  today={today}
                  comparisons={comparisons}
                  pace={check.templateKind === "leitura" ? pace : undefined}
                  paceValues={
                    check.templateKind === "leitura" ? paceValues : undefined
                  }
                />
              </li>
            ))}
        </ul>
      </div>
    </>
  );
}
