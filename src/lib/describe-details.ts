import type { AuditLookups } from "@/db/queries";
import type { Copy } from "@/lib/i18n";

// Turns a habit's `details` into presentation blocks for the Day Audit, so the
// page can give each shape its own treatment (a list of ticked exercises reads
// differently from three sleep numbers) instead of flattening everything into
// label/value lines.

function rec(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export type AuditBlock =
  // One fact: label on the left, value on the right.
  | { kind: "row"; label: string; value: string }
  // Ticked items with an optional trailing figure (exercises + their scheme).
  | {
      kind: "checklist";
      label: string;
      items: { text: string; meta?: string; done: boolean }[];
    }
  // Small stat tiles side by side (pages today/total, sleep numbers).
  | { kind: "tiles"; items: { label: string; value: string }[] }
  // Pills for a set of things (routine blocks followed).
  | { kind: "chips"; label: string; items: string[] }
  // A 1–5 score, drawn as dots.
  | { kind: "rating"; label: string; value: number; max: number };

export function describeDetails(
  slug: string,
  details: unknown,
  lookups: AuditLookups,
  copy: Copy["sheets"],
  todayCopy: Copy["today"]
): AuditBlock[] {
  const d = rec(details);
  if (!d) return [];
  const blocks: AuditBlock[] = [];

  switch (slug) {
    case "treino": {
      const focus = lookups.planDays[Number(d.plan_day_id)];
      if (focus) {
        blocks.push({ kind: "row", label: copy.workout.plan, value: focus });
      }
      if (Array.isArray(d.completed) && d.completed.length > 0) {
        const schemes: Record<string, string> =
          lookups.planExercises[Number(d.plan_day_id)] ?? {};
        blocks.push({
          kind: "checklist",
          label: copy.workout.exercises,
          items: d.completed.map((e) => {
            const er = rec(e);
            const name = String(er?.name ?? "");
            return {
              text: name,
              meta: schemes[name] || undefined,
              done: er?.done === true,
            };
          }),
        });
      }
      if (typeof d.effort === "number") {
        blocks.push({
          kind: "rating",
          label: copy.workout.effort,
          value: d.effort,
          max: 5,
        });
      }
      break;
    }

    case "leitura": {
      const title = lookups.books[Number(d.book_id)];
      if (title) {
        blocks.push({ kind: "row", label: copy.reading.book, value: title });
      }
      const tiles: { label: string; value: string }[] = [];
      if (typeof d.pages_read === "number") {
        tiles.push({ label: copy.reading.today, value: `+${d.pages_read}` });
      }
      if (typeof d.ended_on_page === "number") {
        tiles.push({
          label: copy.reading.total,
          value: String(d.ended_on_page),
        });
      }
      if (tiles.length) blocks.push({ kind: "tiles", items: tiles });
      break;
    }

    case "sono": {
      const tiles: { label: string; value: string }[] = [];
      if (typeof d.hours === "number") {
        tiles.push({ label: copy.sleep.hours, value: `${d.hours}h` });
      }
      tiles.push({
        label: copy.sleep.wokeUp,
        value: d.woke_up_at_night ? "✓" : "—",
      });
      if (typeof d.quality === "number") {
        tiles.push({ label: copy.sleep.quality, value: `${d.quality}/5` });
      }
      blocks.push({ kind: "tiles", items: tiles });
      break;
    }

    case "rotina": {
      if (Array.isArray(d.followed_block_ids)) {
        blocks.push({
          kind: "chips",
          label: copy.routine.followed,
          items: d.followed_block_ids.map(
            (id) => lookups.blocks[Number(id)] ?? `#${id}`
          ),
        });
      }
      if (d.struggled_block_id) {
        blocks.push({
          kind: "row",
          label: copy.routine.struggled,
          value: lookups.blocks[Number(d.struggled_block_id)] ?? "",
        });
      }
      if (typeof d.struggle_note === "string" && d.struggle_note) {
        blocks.push({
          kind: "row",
          label: copy.routine.struggleNote,
          value: d.struggle_note,
        });
      }
      break;
    }

    case "duolingo": {
      if (Array.isArray(d.sessions)) {
        for (const s of d.sessions) {
          const sr = rec(s);
          const lessons = typeof sr?.lessons === "number" ? sr.lessons : 0;
          if (lessons === 0) continue;
          blocks.push({
            kind: "row",
            label: String(
              lookups.languages[String(sr?.language_slug)] ?? sr?.language_slug
            ),
            value:
              lessons === 1
                ? todayCopy.sumLesson.replace("{n}", String(lessons))
                : todayCopy.sumLessons.replace("{n}", String(lessons)),
          });
        }
      }
      break;
    }

    case "espiritualidade": {
      if (Array.isArray(d.practices)) {
        for (const p of d.practices) {
          const pr = rec(p);
          blocks.push({
            kind: "row",
            label: String(lookups.practices[String(pr?.slug)] ?? pr?.slug),
            value: typeof pr?.count === "number" ? `×${pr.count}` : "✓",
          });
        }
      }
      break;
    }

    case "hobby": {
      const tiles: { label: string; value: string }[] = [];
      if (typeof d.activity === "string" && d.activity) {
        tiles.push({ label: copy.hobby.activity, value: d.activity });
      }
      if (typeof d.minutes === "number") {
        tiles.push({ label: copy.hobby.minutes, value: `${d.minutes} min` });
      }
      if (tiles.length) blocks.push({ kind: "tiles", items: tiles });
      break;
    }
  }

  return blocks;
}
