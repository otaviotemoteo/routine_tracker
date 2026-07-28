import type { AuditLookups } from "@/db/queries";
import type { Copy } from "@/lib/i18n";

// Turns a habit's `details` into human-readable "label: value" lines for the
// Day Audit, resolving entity ids/slugs to names via the lookups.

function rec(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export interface AuditLine {
  label: string;
  value: string;
}

export function describeDetails(
  slug: string,
  details: unknown,
  lookups: AuditLookups,
  copy: Copy["sheets"]
): AuditLine[] {
  const d = rec(details);
  if (!d) return [];
  const lines: AuditLine[] = [];

  switch (slug) {
    case "treino": {
      const focus = lookups.planDays[Number(d.plan_day_id)];
      if (focus) lines.push({ label: copy.workout.plan, value: focus });
      if (Array.isArray(d.completed)) {
        lines.push({
          label: "✓",
          value: d.completed
            .map((e) => {
              const er = rec(e);
              return `${er?.name}${er?.done ? " ✓" : " ✗"}`;
            })
            .join(", "),
        });
      }
      if (typeof d.effort === "number") {
        lines.push({ label: copy.workout.effort, value: `${d.effort}/5` });
      }
      break;
    }
    case "leitura": {
      const title = lookups.books[Number(d.book_id)];
      if (title) lines.push({ label: title, value: "" });
      if (typeof d.pages_read === "number") {
        lines.push({
          label: copy.reading.pagesRead,
          value: `+${d.pages_read} → ${d.ended_on_page}`,
        });
      }
      break;
    }
    case "sono": {
      if (typeof d.hours === "number")
        lines.push({ label: copy.sleep.hours, value: `${d.hours} h` });
      lines.push({
        label: copy.sleep.wokeUp,
        value: d.woke_up_at_night ? "✓" : "—",
      });
      if (typeof d.quality === "number")
        lines.push({ label: copy.sleep.quality, value: `${d.quality}/5` });
      break;
    }
    case "rotina": {
      if (Array.isArray(d.followed_block_ids)) {
        lines.push({
          label: copy.routine.followed,
          value:
            d.followed_block_ids
              .map((id) => lookups.blocks[Number(id)] ?? `#${id}`)
              .join(", ") || "—",
        });
      }
      if (d.struggled_block_id) {
        lines.push({
          label: copy.routine.struggled,
          value: lookups.blocks[Number(d.struggled_block_id)] ?? "",
        });
      }
      if (typeof d.struggle_note === "string" && d.struggle_note) {
        lines.push({ label: copy.routine.struggleNote, value: d.struggle_note });
      }
      break;
    }
    case "duolingo": {
      if (Array.isArray(d.sessions)) {
        for (const s of d.sessions) {
          const sr = rec(s);
          const name =
            lookups.languages[String(sr?.language_slug)] ?? sr?.language_slug;
          lines.push({ label: String(name), value: `${sr?.lessons} ${copy.duolingo.lessons}` });
        }
      }
      break;
    }
    case "espiritualidade": {
      if (Array.isArray(d.practices)) {
        for (const p of d.practices) {
          const pr = rec(p);
          const name = lookups.practices[String(pr?.slug)] ?? pr?.slug;
          lines.push({
            label: String(name),
            value: typeof pr?.count === "number" ? `×${pr.count}` : "✓",
          });
        }
      }
      break;
    }
    case "hobby": {
      if (typeof d.activity === "string" && d.activity)
        lines.push({ label: copy.hobby.activity, value: d.activity });
      if (typeof d.minutes === "number")
        lines.push({ label: copy.hobby.minutes, value: `${d.minutes} min` });
      break;
    }
  }
  return lines;
}
