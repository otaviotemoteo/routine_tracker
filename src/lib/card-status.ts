import { format, plural, type Copy } from "@/lib/i18n";
import { summarizeDetails } from "@/lib/summaries";
import type { CheckWithHabit, TodayContext } from "@/types/habit";

// The one-line status a Today card reports: what was logged when the habit is
// done, or what today expects of it when it isn't.
export interface CardStatus {
  done: boolean;
  detail: string | null;
}

export function cardStatus(
  check: CheckWithHabit,
  context: TodayContext,
  copy: Copy["today"]
): CardStatus {
  if (check.done) {
    return {
      done: true,
      detail: summarizeDetails(check.slug, check.details) ?? copy.doneLabel,
    };
  }
  return { done: false, detail: plannedToday(check.slug, context, copy) };
}

// What the user's configuration says about today for this habit. `null` means
// "nothing worth showing" — the card just reads as pending.
function plannedToday(
  slug: string,
  ctx: TodayContext,
  copy: Copy["today"]
): string | null {
  switch (slug) {
    case "treino":
      if (!ctx.plan) return copy.notConfigured;
      // A plan exists but today isn't a training day.
      return ctx.plan.day ? ctx.plan.day.focus : copy.restDay;
    case "leitura":
      if (!ctx.book) return copy.notConfigured;
      return `${ctx.book.title} · ${format(copy.pageOf, {
        current: ctx.book.currentPage,
        total: ctx.book.totalPages,
      })}`;
    case "sono":
      return ctx.sleepTarget
        ? format(copy.sleepTarget, {
            from: ctx.sleepTarget.bedtime,
            to: ctx.sleepTarget.wakeTime,
          })
        : copy.notConfigured;
    case "rotina": {
      const n = ctx.routineBlocks.length;
      return n > 0
        ? format(plural(n, copy.blockToday, copy.blocksToday), { n })
        : copy.notConfigured;
    }
    case "duolingo":
      return ctx.languages.length > 0
        ? ctx.languages.map((l) => l.name).join(", ")
        : copy.notConfigured;
    case "espiritualidade": {
      const n = ctx.practices.length;
      return n > 0
        ? format(plural(n, copy.practiceToday, copy.practicesToday), { n })
        : copy.notConfigured;
    }
    default:
      // Hobby is free-form and optional — the "optional" tag says enough.
      return null;
  }
}
