import { format, locale, type Copy, type Lang } from "@/lib/i18n";
import type { CheckWithHabit, TodayContext } from "@/types/habit";

// Everything a Today card shows, in one shape for all seven habits: one big
// number that carries the point, a line of context under it, and a note pinned
// to the bottom. Same anatomy everywhere → same height, same reading order.

export type CardState = "done" | "pending" | "extra";

export interface TodayCard {
  state: CardState;
  hero: { value: string; unit: string };
  context: string | null;
  note: { primary: string; secondary?: string } | null;
}

// Reading needs figures the card can't derive on its own (they depend on the
// whole book list and the days left in the year).
export interface ReadingPace {
  perDay: number;
  forecast?: string; // already formatted date
}

function rec(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function buildTodayCard(
  check: CheckWithHabit,
  context: TodayContext,
  copy: Copy["today"],
  lang: Lang,
  pace?: ReadingPace
): TodayCard {
  const d = rec(check.details);
  const state: CardState = check.done
    ? check.optional
      ? "extra"
      : "done"
    : "pending";
  const pendingNote = { primary: copy.notePending };

  switch (check.slug) {
    case "treino": {
      // What was logged wins over what was scheduled — you may have trained
      // another day's session, or trained at all on a rest day.
      const loggedDay =
        typeof d?.plan_day_id === "number"
          ? (context.plan?.days.find((x) => x.id === d.plan_day_id) ?? null)
          : null;
      const day = loggedDay ?? context.plan?.day ?? null;
      const completed = Array.isArray(d?.completed) ? d!.completed : [];
      const done = completed.filter((e) => rec(e)?.done === true).length;
      const planned = day?.exercises.length ?? completed.length;
      const sets = (day?.exercises ?? []).reduce(
        (sum, e) => sum + (e.sets ?? 0),
        0
      );
      return {
        state,
        hero: {
          value: planned ? `${done}/${planned}` : String(done),
          unit: copy.unitExercises,
        },
        context: day
          ? sets > 0
            ? format(copy.ctxSets, { focus: day.focus, sets })
            : day.focus
          : context.plan
            ? copy.noteNoTraining
            : copy.ctxNoPlan,
        note:
          typeof d?.effort === "number"
            ? { primary: format(copy.noteEffort, { value: d.effort }) }
            : check.done
              ? null
              : pendingNote,
      };
    }

    case "leitura": {
      const book = context.book;
      const pages = typeof d?.pages_read === "number" ? d.pages_read : 0;
      const page =
        typeof d?.ended_on_page === "number"
          ? d.ended_on_page
          : (book?.currentPage ?? 0);
      return {
        state,
        hero: { value: String(pages), unit: copy.unitPagesToday },
        context: book
          ? format(copy.ctxBookPage, {
              title: book.title,
              page,
              total: book.totalPages,
            })
          : copy.ctxNoBook,
        note: pace
          ? {
              primary: format(copy.notePace, { n: pace.perDay }),
              secondary: pace.forecast
                ? format(copy.noteForecast, { date: pace.forecast })
                : undefined,
            }
          : check.done
            ? null
            : pendingNote,
      };
    }

    case "sono": {
      const hours = typeof d?.hours === "number" ? d.hours : null;
      const target = context.sleepTarget;
      return {
        state,
        hero: {
          value: hours !== null ? `${hours}h` : "—",
          unit: copy.unitSlept,
        },
        context: target
          ? format(copy.ctxSleepTarget, {
              from: target.bedtime,
              to: target.wakeTime,
            })
          : copy.ctxNothingSet,
        note: check.done
          ? {
              primary:
                typeof d?.quality === "number"
                  ? format(copy.noteQuality, { value: d.quality })
                  : d?.woke_up_at_night
                    ? copy.noteWokeUp
                    : copy.noteSleptThrough,
              secondary:
                typeof d?.quality === "number"
                  ? d?.woke_up_at_night
                    ? copy.noteWokeUp
                    : copy.noteSleptThrough
                  : undefined,
            }
          : pendingNote,
      };
    }

    case "rotina": {
      const followed = Array.isArray(d?.followed_block_ids)
        ? d!.followed_block_ids.length
        : 0;
      const total = context.routineBlocks.length;
      const hardest =
        typeof d?.struggled_block_id === "number"
          ? context.routineBlocks.find((b) => b.id === d.struggled_block_id)
          : undefined;
      return {
        state,
        hero: {
          value: total ? `${followed}/${total}` : String(followed),
          unit: copy.unitBlocks,
        },
        context: total
          ? context.routineBlocks.map((b) => b.activity).join(", ")
          : copy.ctxNothingSet,
        note: hardest
          ? {
              primary: format(copy.noteHardest, { block: hardest.activity }),
              secondary:
                typeof d?.struggle_note === "string" && d.struggle_note
                  ? format(copy.noteStruggle, { note: d.struggle_note })
                  : undefined,
            }
          : check.done
            ? null
            : pendingNote,
      };
    }

    case "duolingo": {
      const sessions = Array.isArray(d?.sessions) ? d!.sessions.map(rec) : [];
      const practiced = sessions.filter(
        (s) => typeof s?.lessons === "number" && s.lessons > 0
      );
      const totalLessons = practiced.reduce<number>(
        (sum, s) => sum + (typeof s?.lessons === "number" ? s.lessons : 0),
        0
      );
      // "1 lesson in each" only reads true when every one got the same count.
      const uniform =
        practiced.length > 1 &&
        practiced.every((s) => s?.lessons === practiced[0]?.lessons);
      return {
        state,
        hero: {
          value: String(practiced.length),
          unit: copy.unitLanguages,
        },
        context: context.languages.length
          ? context.languages.map((l) => l.name).join(", ")
          : copy.ctxNothingSet,
        note: totalLessons
          ? {
              primary: uniform
                ? format(copy.noteLessonsEach, {
                    n: Number(practiced[0]?.lessons ?? 0),
                  })
                : format(copy.noteLessonsTotal, { n: totalLessons }),
            }
          : pendingNote,
      };
    }

    case "espiritualidade": {
      const done = Array.isArray(d?.practices) ? d!.practices.map(rec) : [];
      const names = done
        .map(
          (p) =>
            context.practices.find((x) => x.slug === String(p?.slug))?.name
        )
        .filter(Boolean)
        .join(", ");
      return {
        state,
        hero: {
          value: String(done.length),
          unit: format(copy.unitOfPractices, { total: context.practices.length }),
        },
        context: context.practices.length
          ? context.practices.map((p) => p.name).join(", ")
          : copy.ctxNothingSet,
        note: names
          ? { primary: format(copy.notePracticesDone, { names }) }
          : pendingNote,
      };
    }

    case "hobby": {
      const minutes = typeof d?.minutes === "number" ? d.minutes : null;
      const activity =
        typeof d?.activity === "string" && d.activity ? d.activity : null;
      return {
        state,
        hero: {
          value: minutes !== null ? String(minutes) : "—",
          unit: activity
            ? format(copy.unitMinutesOf, { activity })
            : copy.unitMinutes,
        },
        // The activity already rides in the unit — repeating it adds nothing.
        context: null,
        note: {
          primary: copy.noteOptional,
          secondary: copy.noteOptionalSub,
        },
      };
    }

    default:
      return {
        state,
        hero: { value: check.done ? "✓" : "—", unit: "" },
        context: null,
        note: check.done ? null : pendingNote,
      };
  }
}

// "12 de outubro" — when the current book runs out at the required pace.
export function forecastFinishDate(
  pagesLeft: number,
  perDay: number,
  lang: Lang
): string | undefined {
  if (pagesLeft <= 0 || perDay <= 0) return undefined;
  const days = Math.ceil(pagesLeft / perDay);
  const finish = new Date();
  finish.setUTCHours(12, 0, 0, 0);
  finish.setUTCDate(finish.getUTCDate() + days);
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(finish);
}

