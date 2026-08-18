import type { UserId } from "@/db/scope";
// Server-only: one summary of everything the user configured, shared by the
// onboarding Review step, the /config index and the Overview "Activities"
// section — so those three never drift.
import {
  getReadingConfig,
  getSleepConfig,
  getWorkoutConfig,
  listLanguages,
  listRoutineBlocks,
  listSpiritualPractices,
} from "@/db/rich-habits";
import { format, plural, type Copy } from "@/lib/i18n";
import { daysLeftInYear, readingPace, todayInSaoPaulo } from "@/lib/utils";

export type SetupSection =
  | "workout"
  | "reading"
  | "sleep"
  | "routine"
  | "duolingo"
  | "spirituality";

// The three numbers behind the reading pace, so the dialog can show its own
// arithmetic instead of just describing it.
export interface PaceValues {
  currentBookLeft: number; // Pa
  nextBooksPages: number; // Pp
  daysLeft: number; // Dr
  perDay: number;
}

export interface SetupRow {
  section: SetupSection;
  label: string;
  // Whether this area has been set up at all (drives the badge + tint).
  configured: boolean;
  value: string | null; // null → "not set"
  // The third line of the row: what this area is set up to do, as a count.
  // Every section has one, and that is the point — a three-line stack where
  // five of six rows only fill two lines reads as unfinished rather than as
  // sparse. Counts only, straight off the rows that exist, so there is never
  // a figure here the data can't support.
  meta?: string;
  hint?: string; // e.g. the reading pace, or what's still missing
  // "warn" = something still needs the user's attention (straw), "info" = a
  // healthy stat (clover).
  hintTone?: "info" | "warn";
  // Reading only, and only when the pace is real.
  paceValues?: PaceValues;
}

// Hours between bedtime and wake time, wrapping past midnight.
function sleepWindowHours(bedtime: string, wakeTime: string): number {
  const mins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const span = (mins(wakeTime) - mins(bedtime) + 1440) % 1440;
  return Math.round(span / 60);
}

export async function getSetupSummary(
  userId: UserId,
  copy: Copy["onboarding"],
  todayCopy?: Copy["today"]
): Promise<SetupRow[]> {
  const today = todayInSaoPaulo();
  const year = Number(today.slice(0, 4));
  const [workout, reading, sleep, routine, langs, practices] = await Promise.all([
    getWorkoutConfig(userId),
    getReadingConfig(userId),
    getSleepConfig(userId),
    listRoutineBlocks(userId),
    listLanguages(userId),
    listSpiritualPractices(userId),
  ]);

  const plan = workout ? { name: workout.planName, days: workout.days.filter((d) => d.active) } : null;
  // The goal is per-year — see onboarding-prefill.ts's readingInitial for the
  // same rule: a target saved in an earlier year reads as unset here too.
  const goal = reading && reading.year === year ? reading.targetBooksPerYear : null;
  const books = reading?.books ?? [];

  // Reading hint. The list must be complete before a pace means anything —
  // otherwise it quotes a target computed from books the user hasn't added yet.
  let readingHint: string | undefined;
  let readingTone: "info" | "warn" | undefined;
  let paceValues: PaceValues | undefined;
  const missingBooks = goal ? goal - books.length : 0;
  if (todayCopy && missingBooks > 0) {
    readingHint = format(
      plural(missingBooks, todayCopy.bookMissing, todayCopy.booksMissing),
      { n: missingBooks }
    );
    readingTone = "warn";
  } else if (todayCopy) {
    const unread = books.filter(
      (b) => b.status === "reading" || b.status === "queued"
    );
    // Split the two halves of the formula: what's left in the book being read,
    // and everything waiting after it.
    const currentBookLeft = unread
      .filter((b) => b.status === "reading")
      .reduce((sum, b) => sum + Math.max(0, b.totalPages - b.currentPage), 0);
    const nextBooksPages = unread
      .filter((b) => b.status !== "reading")
      .reduce((sum, b) => sum + Math.max(0, b.totalPages - b.currentPage), 0);
    const remainingPages = currentBookLeft + nextBooksPages;
    if (remainingPages > 0) {
      const daysLeft = daysLeftInYear(today);
      const perDay = readingPace(remainingPages, daysLeft);
      readingHint = format(todayCopy.pace, { n: perDay });
      readingTone = "info";
      paceValues = { currentBookLeft, nextBooksPages, daysLeft, perDay };
    }
  }

  return [
    {
      section: "workout",
      label: copy.review.sections.workout,
      configured: plan !== null,
      value: plan ? plan.name : null,
      meta: plan
        ? format(copy.review.meta.workoutDays, { n: plan.days.length })
        : undefined,
    },
    {
      section: "reading",
      label: copy.review.sections.reading,
      configured: goal !== null || books.length > 0,
      value: goal ? `${goal} ${copy.reading.goalUnit}` : null,
      meta: books.length
        ? format(copy.review.meta.books, { n: books.length })
        : undefined,
      hint: readingHint,
      hintTone: readingTone,
      paceValues,
    },
    {
      section: "sleep",
      label: copy.review.sections.sleep,
      configured: sleep !== null,
      value: sleep ? `${sleep.bedtime} – ${sleep.wakeTime}` : null,
      // Wall-clock hours between the two times, wrapping past midnight — a
      // 23:00–06:00 window is 7 hours, not −17.
      meta: sleep
        ? format(copy.review.meta.sleepWindow, {
            n: sleepWindowHours(sleep.bedtime, sleep.wakeTime),
          })
        : undefined,
    },
    {
      section: "routine",
      label: copy.review.sections.routine,
      configured: routine.length > 0,
      value: routine.length
        ? routine.map((b) => b.activity).slice(0, 3).join(", ")
        : null,
      meta: routine.length
        ? format(copy.review.meta.routineBlocks, { n: routine.length })
        : undefined,
    },
    {
      section: "duolingo",
      label: copy.review.sections.duolingo,
      configured: langs.length > 0,
      value: langs.length ? langs.map((l) => l.name).join(", ") : null,
      meta: langs.length
        ? format(copy.review.meta.languages, { n: langs.length })
        : undefined,
    },
    {
      section: "spirituality",
      label: copy.review.sections.spirituality,
      configured: practices.length > 0,
      value: practices.length ? practices.map((p) => p.name).join(", ") : null,
      meta: practices.length
        ? format(copy.review.meta.practices, { n: practices.length })
        : undefined,
    },
  ];
}
