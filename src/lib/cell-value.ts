// The shortest honest label for one habit on one day — what fits in a grid
// cell's tooltip ("9 pg", "6h10", "4/6"). Symbols read the same in both
// languages, so this needs no copy.
import { templateKindOf } from "@/lib/templates";

function rec(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export interface CellValue {
  label: string;
  // Logged, but short of the plan (3 of 5 exercises) — drawn in straw.
  partial: boolean;
}

// Configured sizes the details themselves don't carry, so "4" can be shown as
// "4/6" — the shortfall is the point.
export interface CellTotals {
  routineBlocks?: number;
  practices?: number;
}

export function cellValue(
  kind: string | null,
  details: unknown,
  done: boolean,
  totals: CellTotals = {},
  // A generic habit's own target, which is per-habit rather than per-account
  // and so can't live in CellTotals.
  target: number | null = null
): CellValue | null {
  const d = rec(details);
  if (!d) return done ? { label: "✓", partial: false } : null;

  switch (templateKindOf(kind)) {
    case "treino": {
      if (!Array.isArray(d.completed) || d.completed.length === 0) break;
      const total = d.completed.length;
      const doneCount = d.completed.filter((e) => rec(e)?.done === true).length;
      return { label: `${doneCount}/${total}`, partial: doneCount < total };
    }
    case "leitura":
      if (typeof d.pages_read === "number") {
        return { label: `${d.pages_read} pg`, partial: false };
      }
      break;
    case "sono":
      if (typeof d.hours === "number") {
        const hours = Math.floor(d.hours);
        const minutes = Math.round((d.hours - hours) * 60);
        return {
          label:
            minutes === 0
              ? `${hours}h`
              : `${hours}h${String(minutes).padStart(2, "0")}`,
          partial: false,
        };
      }
      break;
    case "rotina": {
      if (!Array.isArray(d.followed_block_ids)) break;
      const followed = d.followed_block_ids.length;
      const total = totals.routineBlocks;
      return total
        ? { label: `${followed}/${total}`, partial: followed < total }
        : { label: String(followed), partial: false };
    }
    case "duolingo": {
      if (!Array.isArray(d.sessions)) break;
      const lessons = d.sessions.reduce<number>((sum, s) => {
        const n = rec(s)?.lessons;
        return sum + (typeof n === "number" ? n : 0);
      }, 0);
      if (lessons > 0) return { label: `${lessons}×`, partial: false };
      break;
    }
    case "espiritualidade": {
      if (!Array.isArray(d.practices) || d.practices.length === 0) break;
      // Never "partial": one prayer is a day of prayer, not a shortfall — the
      // configured practices are a menu, not a checklist.
      const kept = d.practices.length;
      return {
        label: totals.practices ? `${kept}/${totals.practices}` : String(kept),
        partial: false,
      };
    }
    case "hobby":
      if (typeof d.minutes === "number") {
        return { label: `${d.minutes}m`, partial: false };
      }
      break;

    case "checklist": {
      if (!Array.isArray(d.done_items)) break;
      // No total to compare against here — that lives in the habit's own
      // config, which this function isn't handed — so, like duolingo/hobby
      // above, the day's count stands on its own rather than pretending to a
      // "3/3" this file can't verify.
      const kept = d.done_items.length;
      return kept > 0
        ? { label: `${kept}✓`, partial: false }
        : done
          ? { label: "✓", partial: false }
          : null;
    }

    // A generic habit — every one of `plain`, and the four card-style-chooser
    // kinds that read the same day shape (`number`, `check`, `duration`,
    // `streak`; see details-schemas.ts). No unit in the label: the seven
    // legacy kinds above use hand-tuned abbreviations ("pg", "×", "m") that a
    // user-supplied unit like "pages read" would not fit into, and a
    // truncated unit is worse than none. The number, and the target when
    // there is one, are the honest maximum.
    case "plain":
    case "number":
    case "check":
    case "duration":
    case "streak": {
      if (typeof d.value !== "number") break;
      // Partial needs a plan to fall short of. With no target there is
      // nothing to be short of, so a logged day is simply done.
      if (target !== null && target > 0) {
        return {
          label: `${d.value}/${target}`,
          partial: d.value < target,
        };
      }
      // A binary habit logs 1, and "1" in a grid cell says less than a tick.
      return d.value > 0
        ? { label: String(d.value), partial: false }
        : done
          ? { label: "✓", partial: false }
          : null;
    }
  }

  return done ? { label: "✓", partial: false } : null;
}
