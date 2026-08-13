import { format, plural, type Copy } from "@/lib/i18n";
import { templateKindOf } from "@/lib/templates";
import type { TodayContext } from "@/types/habit";

// What a logged habit actually amounted to, as a sentence. Shorthand like
// "5/5" or "+9p" is compact but needs decoding — these read at a glance.

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function summarizeDetails(
  kind: string | null,
  details: unknown,
  context: TodayContext,
  copy: Copy["today"],
  // A generic habit's own unit, so its sentence can say "23 pages" rather
  // than a bare "23". Null for the seven, which name their own units.
  unit: string | null = null
): string | null {
  const d = asRecord(details);
  if (!d) return null;

  switch (templateKindOf(kind)) {
    case "treino": {
      if (!Array.isArray(d.completed) || d.completed.length === 0) return null;
      const total = d.completed.length;
      const done = d.completed.filter((e) => asRecord(e)?.done === true).length;
      return done === total
        ? copy.sumAllExercises
        : format(copy.sumExercises, { done, total });
    }

    case "leitura": {
      if (typeof d.pages_read !== "number") return null;
      return format(plural(d.pages_read, copy.sumPage, copy.sumPages), {
        n: d.pages_read,
      });
    }

    case "sono":
      return typeof d.hours === "number"
        ? format(copy.sumHours, { n: d.hours })
        : null;

    case "rotina": {
      if (!Array.isArray(d.followed_block_ids)) return null;
      const done = d.followed_block_ids.length;
      // The plan is the day's blocks; fall back to what was logged if the
      // routine has since changed.
      const total = Math.max(context.routineBlocks.length, done);
      if (total === 0) return null;
      return done === total
        ? copy.sumAllBlocks
        : format(copy.sumBlocks, { done, total });
    }

    case "duolingo": {
      if (!Array.isArray(d.sessions)) return null;
      const sessions = d.sessions.map(asRecord);
      const total = sessions.reduce<number>((sum, s) => {
        const lessons = s?.lessons;
        return sum + (typeof lessons === "number" ? lessons : 0);
      }, 0);
      if (total === 0) return null;
      const practiced = sessions.filter(
        (s) => typeof s?.lessons === "number" && s.lessons > 0
      ).length;
      // Every configured language got at least one lesson.
      if (practiced > 1 && practiced === context.languages.length) {
        return copy.sumAllLanguages;
      }
      return format(plural(total, copy.sumLesson, copy.sumLessons), { n: total });
    }

    case "espiritualidade": {
      if (!Array.isArray(d.practices) || d.practices.length === 0) return null;
      const n = d.practices.length;
      return format(plural(n, copy.sumPractice, copy.sumPractices), { n });
    }

    case "hobby": {
      const activity =
        typeof d.activity === "string" && d.activity ? d.activity : null;
      const minutes =
        typeof d.minutes === "number"
          ? format(copy.sumMinutes, { n: d.minutes })
          : null;
      if (activity && minutes) return `${activity} · ${minutes}`;
      return activity ?? minutes;
    }

    // A generic habit. "23 pages" when it names a unit, "23" when it doesn't,
    // and nothing at all for a binary habit — where the value is 1 and the
    // caller already renders "Done", so "1" would add a figure that says less
    // than the word it sits beside.
    case "plain": {
      if (typeof d.value !== "number") return null;
      if (d.value === 0) return null;
      return unit ? `${d.value} ${unit}` : String(d.value);
    }

    default:
      return null;
  }
}
