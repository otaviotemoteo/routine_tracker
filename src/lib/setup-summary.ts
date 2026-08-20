import type { UserId } from "@/db/scope";
// Server-only: one summary of every configured rich-kind ACTIVITY, shared by
// /config's index and Overview's "Activities" section — so those two never
// drift. One row per activity that exists now, not six fixed account-wide
// slots — see docs/HABIT-VS-ACTIVITY-MODEL.md. An account with no workout
// activity simply has no workout row, rather than a permanent "not set"
// nudge for something nobody asked to track.
import { listTrackedActivities } from "@/db/habits";
import type {
  DuolingoConfig,
  ReadingConfig,
  RoutineConfig,
  SleepConfig,
  SpiritualityConfig,
  WorkoutConfig,
} from "@/lib/config-schemas";
import { format, plural, type Copy } from "@/lib/i18n";
import { daysLeftInYear, readingPace, todayInSaoPaulo } from "@/lib/utils";

// The three numbers behind the reading pace, so the dialog can show its own
// arithmetic instead of just describing it.
export interface PaceValues {
  currentBookLeft: number; // Pa
  nextBooksPages: number; // Pp
  daysLeft: number; // Dr
  perDay: number;
}

const RICH_LABEL_KEY = {
  treino: "workout",
  leitura: "reading",
  sono: "sleep",
  rotina: "routine",
  duolingo: "duolingo",
  espiritualidade: "spirituality",
} as const;

type RichKind = keyof typeof RICH_LABEL_KEY;

function isRichKind(kind: string | null): kind is RichKind {
  return kind !== null && kind in RICH_LABEL_KEY;
}

export interface SetupRow {
  activityId: number;
  habitId: number;
  habitName: string;
  templateKind: RichKind;
  label: string;
  // Whether this activity has real setup behind it yet (drives the badge +
  // tint) — an activity can carry a rich kind with nothing filled in yet.
  configured: boolean;
  value: string | null; // null → "not set"
  // The third line of the row: what this activity is set up to do, as a
  // count. Counts only, straight off the rows that exist, so there is never
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
  const richActivities = (await listTrackedActivities(userId)).filter((a) =>
    isRichKind(a.templateKind)
  );

  return richActivities.map((activity): SetupRow => {
    const kind = activity.templateKind as RichKind;
    const base = {
      activityId: activity.id,
      habitId: activity.habitId,
      habitName: activity.habitName,
      templateKind: kind,
      label: copy.review.sections[RICH_LABEL_KEY[kind]],
    };

    switch (kind) {
      case "treino": {
        const cfg = (activity.config as WorkoutConfig | null) ?? {
          planName: "",
          days: [],
        };
        const activeDays = cfg.days.filter((d) => d.active);
        return {
          ...base,
          configured: activeDays.length > 0 || cfg.planName.length > 0,
          value: cfg.planName || null,
          meta: activeDays.length
            ? format(copy.review.meta.workoutDays, { n: activeDays.length })
            : undefined,
        };
      }

      case "leitura": {
        const cfg = (activity.config as ReadingConfig | null) ?? {
          year: 0,
          targetBooksPerYear: 0,
          books: [],
        };
        // The goal is per-year — a target saved in an earlier year reads as
        // unset, same rule onboarding-prefill.ts's readingInitial uses.
        const goal = cfg.year === year ? cfg.targetBooksPerYear : null;
        const books = cfg.books;

        // The list must be complete before a pace means anything — otherwise
        // it quotes a target computed from books the user hasn't added yet.
        let hint: string | undefined;
        let hintTone: "info" | "warn" | undefined;
        let paceValues: PaceValues | undefined;
        const missingBooks = goal ? goal - books.length : 0;
        if (todayCopy && missingBooks > 0) {
          hint = format(
            plural(missingBooks, todayCopy.bookMissing, todayCopy.booksMissing),
            { n: missingBooks }
          );
          hintTone = "warn";
        } else if (todayCopy) {
          const unread = books.filter(
            (b) => b.status === "reading" || b.status === "queued"
          );
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
            hint = format(todayCopy.pace, { n: perDay });
            hintTone = "info";
            paceValues = { currentBookLeft, nextBooksPages, daysLeft, perDay };
          }
        }

        return {
          ...base,
          configured: goal !== null || books.length > 0,
          value: goal ? `${goal} ${copy.reading.goalUnit}` : null,
          meta: books.length
            ? format(copy.review.meta.books, { n: books.length })
            : undefined,
          hint,
          hintTone,
          paceValues,
        };
      }

      case "sono": {
        const cfg = activity.config as SleepConfig | null;
        return {
          ...base,
          configured: cfg !== null,
          value: cfg ? `${cfg.bedtime} – ${cfg.wakeTime}` : null,
          // Wall-clock hours between the two times, wrapping past midnight —
          // a 23:00–06:00 window is 7 hours, not −17.
          meta: cfg
            ? format(copy.review.meta.sleepWindow, {
                n: sleepWindowHours(cfg.bedtime, cfg.wakeTime),
              })
            : undefined,
        };
      }

      case "rotina": {
        const cfg = (activity.config as RoutineConfig | null) ?? { blocks: [] };
        const active = cfg.blocks.filter((b) => b.active);
        return {
          ...base,
          configured: active.length > 0,
          value: active.length
            ? active.map((b) => b.activity).slice(0, 3).join(", ")
            : null,
          meta: active.length
            ? format(copy.review.meta.routineBlocks, { n: active.length })
            : undefined,
        };
      }

      case "duolingo": {
        const cfg = (activity.config as DuolingoConfig | null) ?? { languages: [] };
        const active = cfg.languages.filter((l) => l.active);
        return {
          ...base,
          configured: active.length > 0,
          value: active.length ? active.map((l) => l.name).join(", ") : null,
          meta: active.length
            ? format(copy.review.meta.languages, { n: active.length })
            : undefined,
        };
      }

      case "espiritualidade": {
        const cfg = (activity.config as SpiritualityConfig | null) ?? {
          practices: [],
        };
        const active = cfg.practices.filter((p) => p.active);
        return {
          ...base,
          configured: active.length > 0,
          value: active.length ? active.map((p) => p.name).join(", ") : null,
          meta: active.length
            ? format(copy.review.meta.practices, { n: active.length })
            : undefined,
        };
      }
    }
  });
}
