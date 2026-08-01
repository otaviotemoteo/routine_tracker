// Server-only: one summary of everything the user configured, shared by the
// onboarding Review step, the /config index and the Overview "Activities"
// section — so those three never drift.
import {
  getActiveWorkoutPlan,
  getReadingGoal,
  getSleepTarget,
  listBooks,
  listLanguages,
  listRoutineBlocks,
  listSpiritualPractices,
} from "@/db/queries";
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
  hint?: string; // e.g. the reading pace, or what's still missing
  // "warn" = something still needs the user's attention (straw), "info" = a
  // healthy stat (clover).
  hintTone?: "info" | "warn";
  // Reading only, and only when the pace is real.
  paceValues?: PaceValues;
}

export async function getSetupSummary(
  userId: number,
  copy: Copy["onboarding"],
  todayCopy?: Copy["today"]
): Promise<SetupRow[]> {
  const today = todayInSaoPaulo();
  const [plan, goal, books, sleep, routine, langs, practices] = await Promise.all([
    getActiveWorkoutPlan(userId),
    getReadingGoal(userId, Number(today.slice(0, 4))),
    listBooks(userId),
    getSleepTarget(userId),
    listRoutineBlocks(userId),
    listLanguages(userId),
    listSpiritualPractices(userId),
  ]);

  // Reading hint. The list must be complete before a pace means anything —
  // otherwise it quotes a target computed from books the user hasn't added yet.
  let readingHint: string | undefined;
  let readingTone: "info" | "warn" | undefined;
  let paceValues: PaceValues | undefined;
  const missingBooks = goal ? goal.targetBooks - books.length : 0;
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
    },
    {
      section: "reading",
      label: copy.review.sections.reading,
      configured: goal !== null || books.length > 0,
      value: goal ? `${goal.targetBooks} ${copy.reading.goalUnit}` : null,
      hint: readingHint,
      hintTone: readingTone,
      paceValues,
    },
    {
      section: "sleep",
      label: copy.review.sections.sleep,
      configured: sleep !== null,
      value: sleep
        ? `${sleep.bedtime.slice(0, 5)} – ${sleep.wakeTime.slice(0, 5)}`
        : null,
    },
    {
      section: "routine",
      label: copy.review.sections.routine,
      configured: routine.length > 0,
      value: routine.length
        ? routine.map((b) => b.activity).slice(0, 3).join(", ")
        : null,
    },
    {
      section: "duolingo",
      label: copy.review.sections.duolingo,
      configured: langs.length > 0,
      value: langs.length ? langs.map((l) => l.name).join(", ") : null,
    },
    {
      section: "spirituality",
      label: copy.review.sections.spirituality,
      configured: practices.length > 0,
      value: practices.length ? practices.map((p) => p.name).join(", ") : null,
    },
  ];
}
