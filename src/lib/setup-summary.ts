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

export interface SetupRow {
  section: SetupSection;
  label: string;
  value: string | null; // null → "not set"
  hint?: string; // e.g. the reading pace, or what's still missing
  // "warn" = something still needs the user's attention (straw), "info" = a
  // healthy stat (clover).
  hintTone?: "info" | "warn";
}

export async function getSetupSummary(
  copy: Copy["onboarding"],
  todayCopy?: Copy["today"]
): Promise<SetupRow[]> {
  const today = todayInSaoPaulo();
  const [plan, goal, books, sleep, routine, langs, practices] = await Promise.all([
    getActiveWorkoutPlan(),
    getReadingGoal(Number(today.slice(0, 4))),
    listBooks(),
    getSleepTarget(),
    listRoutineBlocks(),
    listLanguages(),
    listSpiritualPractices(),
  ]);

  // Reading hint. The list must be complete before a pace means anything —
  // otherwise it quotes a target computed from books the user hasn't added yet.
  let readingHint: string | undefined;
  let readingTone: "info" | "warn" | undefined;
  const missingBooks = goal ? goal.targetBooks - books.length : 0;
  if (todayCopy && missingBooks > 0) {
    readingHint = format(
      plural(missingBooks, todayCopy.bookMissing, todayCopy.booksMissing),
      { n: missingBooks }
    );
    readingTone = "warn";
  } else if (todayCopy) {
    const remainingPages = books
      .filter((b) => b.status === "reading" || b.status === "queued")
      .reduce((sum, b) => sum + Math.max(0, b.totalPages - b.currentPage), 0);
    if (remainingPages > 0) {
      readingHint = format(todayCopy.pace, {
        n: readingPace(remainingPages, daysLeftInYear(today)),
      });
      readingTone = "info";
    }
  }

  return [
    {
      section: "workout",
      label: copy.review.sections.workout,
      value: plan ? plan.name : null,
    },
    {
      section: "reading",
      label: copy.review.sections.reading,
      value: goal ? `${goal.targetBooks} ${copy.reading.goalUnit}` : null,
      hint: readingHint,
      hintTone: readingTone,
    },
    {
      section: "sleep",
      label: copy.review.sections.sleep,
      value: sleep
        ? `${sleep.bedtime.slice(0, 5)} – ${sleep.wakeTime.slice(0, 5)}`
        : null,
    },
    {
      section: "routine",
      label: copy.review.sections.routine,
      value: routine.length
        ? routine.map((b) => b.activity).slice(0, 3).join(", ")
        : null,
    },
    {
      section: "duolingo",
      label: copy.review.sections.duolingo,
      value: langs.length ? langs.map((l) => l.name).join(", ") : null,
    },
    {
      section: "spirituality",
      label: copy.review.sections.spirituality,
      value: practices.length ? practices.map((p) => p.name).join(", ") : null,
    },
  ];
}
