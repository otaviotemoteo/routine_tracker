// Data access for habits. Sibling of queries.ts and assessment.ts, under the
// same two rules: every function takes the (branded) user id first, and every
// id-addressed write filters on the user too, so a foreign id matches no row
// rather than being mutated.
//
// The one thing this module adds over its siblings is the proposed/tracked
// split. A habit with `active_from IS NULL` has been written to the database
// but not accepted: it exists so that a 5–20 second generation survives a
// refresh, and it is invisible to every screen except the review one. The
// filters live in src/db/scope.ts so no caller can forget them.
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./index";
import { habits, lifeDomains, type HabitSource, type MetricType } from "./schema";
import { habitsFor, proposedHabitsFor, type UserId } from "./scope";
import { storedTemplateKind, type SuggestableTemplateKind } from "@/lib/templates";
import type { DomainSlug } from "@/lib/domains";

export interface HabitRow {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  optional: boolean;
  domainId: number | null;
  domainSlug: DomainSlug | null;
  metricType: MetricType;
  unit: string | null;
  target: number | null;
  minimalAction: string | null;
  templateKind: string | null;
  source: HabitSource;
  why: string | null;
  activeFrom: string | null;
  activeTo: string | null;
  position: number;
}

// What the form and the generator both produce. Deliberately has no `config`
// and no `templateKind` beyond the suggestable set — see src/lib/templates.ts.
export interface HabitInput {
  name: string;
  domainSlug: DomainSlug | null;
  metricType: MetricType;
  unit: string | null;
  target: number | null;
  minimalAction: string | null;
  templateKind: SuggestableTemplateKind;
  why: string | null;
}

const habitColumns = {
  id: habits.id,
  name: habits.name,
  slug: habits.slug,
  icon: habits.icon,
  optional: habits.optional,
  domainId: habits.domainId,
  domainSlug: lifeDomains.slug,
  metricType: habits.metricType,
  unit: habits.unit,
  target: habits.target,
  minimalAction: habits.minimalAction,
  templateKind: habits.templateKind,
  source: habits.source,
  why: habits.why,
  activeFrom: habits.activeFrom,
  activeTo: habits.activeTo,
  position: habits.position,
};

// A left join, not an inner one: a habit added by hand before any assessment
// has no area, and rendering it as "not yet anchored to a value" is the point
// (it is useful data, not a broken row).
function selectHabits() {
  return db
    .select(habitColumns)
    .from(habits)
    .leftJoin(lifeDomains, eq(habits.domainId, lifeDomains.id));
}

function toRow(r: Awaited<ReturnType<typeof selectHabits>>[number]): HabitRow {
  return { ...r, domainSlug: (r.domainSlug as DomainSlug | null) ?? null };
}

// ─── Reads ───────────────────────────────────────────────────────────────────

// The tracked set: what Today, the grid and the daily flow render.
export async function listHabits(
  userId: UserId,
  onDate?: string
): Promise<HabitRow[]> {
  const rows = await selectHabits()
    .where(habitsFor(userId, onDate))
    .orderBy(asc(habits.position), asc(habits.id));
  return rows.map(toRow);
}

// The proposed set: only the review screen reads this. Named so that asking
// for un-accepted habits is always a deliberate act.
export async function listProposedHabits(userId: UserId): Promise<HabitRow[]> {
  const rows = await selectHabits()
    .where(proposedHabitsFor(userId))
    .orderBy(asc(habits.position), asc(habits.id));
  return rows.map(toRow);
}

// Single habit for the edit form. Covers both sets — you can edit a proposal
// and a tracked habit through the same screen — but never crosses accounts.
export async function getHabit(
  userId: UserId,
  id: number
): Promise<HabitRow | null> {
  const [row] = await selectHabits().where(
    and(eq(habits.id, id), eq(habits.userId, userId))
  );
  return row ? toRow(row) : null;
}

export async function countTrackedHabits(userId: UserId): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(habits)
    .where(habitsFor(userId));
  return row?.n ?? 0;
}

// ─── Writes ──────────────────────────────────────────────────────────────────

// Slugs are per-account now, so two people can both have "leitura". Within one
// account they still have to be unique, because `details` and every legacy
// renderer key on them.
async function uniqueSlug(
  userId: UserId,
  name: string,
  exceptId?: number
): Promise<string> {
  const base =
    slugify(name) ||
    // A name of only punctuation or emoji leaves nothing to slugify.
    `habit-${Date.now().toString(36)}`;
  const taken = await db
    .select({ slug: habits.slug })
    .from(habits)
    .where(eq(habits.userId, userId));
  const used = new Set(
    taken.map((t) => t.slug).filter((s) => s !== undefined)
  );
  if (exceptId !== undefined) {
    const [current] = await db
      .select({ slug: habits.slug })
      .from(habits)
      .where(and(eq(habits.id, exceptId), eq(habits.userId, userId)));
    if (current) used.delete(current.slug);
  }
  if (!used.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

// Local copy rather than importing from onboarding.ts: that module is about
// the wizard, and a habit slug should not start depending on it.
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function domainIdFor(slug: DomainSlug | null): Promise<number | null> {
  if (!slug) return null;
  const [row] = await db
    .select({ id: lifeDomains.id })
    .from(lifeDomains)
    .where(eq(lifeDomains.slug, slug));
  return row?.id ?? null;
}

// Create a habit. `activeFrom` decides which of the two sets it lands in:
// a date means tracked immediately (the manual form), null means proposed
// (the generator, and anything added on the review screen alongside it).
export async function createHabit(
  userId: UserId,
  input: HabitInput,
  options: { source: HabitSource; activeFrom: string | null }
): Promise<number> {
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${habits.position}), 0)` })
    .from(habits)
    .where(eq(habits.userId, userId));

  const [row] = await db
    .insert(habits)
    .values({
      userId,
      name: input.name,
      slug: await uniqueSlug(userId, input.name),
      domainId: await domainIdFor(input.domainSlug),
      metricType: input.metricType,
      unit: input.unit,
      target: input.target,
      minimalAction: input.minimalAction,
      templateKind: storedTemplateKind(input.templateKind),
      source: options.source,
      why: input.why,
      activeFrom: options.activeFrom,
      position: Number(max) + 1,
    })
    .returning({ id: habits.id });
  return row.id;
}

// Update a habit's wording. Never touches active_from, so editing a proposal
// leaves it a proposal and editing a tracked habit leaves it tracked.
//
// `source` moves ai_suggested → ai_edited on the first edit and then stops:
// once a human has touched it, touching it again says nothing new, and
// promoting a 'human' habit to 'ai_edited' would be a lie.
export async function updateHabit(
  userId: UserId,
  id: number,
  input: HabitInput
): Promise<boolean> {
  const rows = await db
    .update(habits)
    .set({
      name: input.name,
      domainId: await domainIdFor(input.domainSlug),
      metricType: input.metricType,
      unit: input.unit,
      target: input.target,
      minimalAction: input.minimalAction,
      templateKind: storedTemplateKind(input.templateKind),
      why: input.why,
      source: sql`CASE WHEN ${habits.source} = 'ai_suggested'
                       THEN 'ai_edited' ELSE ${habits.source} END`,
    })
    .where(and(eq(habits.id, id), eq(habits.userId, userId)))
    .returning({ id: habits.id });
  return rows.length > 0;
}

// Remove, which means two different things depending on the set:
//
//   proposed (active_from IS NULL)  DELETE. Nothing can reference it —
//                                   getDayChecks never materialises a check
//                                   for a habit it cannot see — so the row is
//                                   genuinely disposable. What was proposed
//                                   is still recorded in ai_runs.output, so
//                                   the rejection rate survives the delete.
//
//   tracked                         set active_to. Never delete: daily_checks
//                                   reference the row, and a habit you kept
//                                   for three months is part of the record
//                                   even after you stop.
export async function removeHabit(
  userId: UserId,
  id: number,
  today: string
): Promise<boolean> {
  const deleted = await db
    .delete(habits)
    .where(
      and(eq(habits.id, id), eq(habits.userId, userId), isNull(habits.activeFrom))
    )
    .returning({ id: habits.id });
  if (deleted.length > 0) return true;

  const archived = await db
    .update(habits)
    .set({ activeTo: today })
    .where(
      and(
        eq(habits.id, id),
        eq(habits.userId, userId),
        isNull(habits.activeTo)
      )
    )
    .returning({ id: habits.id });
  return archived.length > 0;
}

// "Start tracking": the whole proposed set becomes real in one statement.
// Returns how many, so the caller can tell an empty press from a real one.
export async function activateProposedHabits(
  userId: UserId,
  today: string
): Promise<number> {
  const rows = await db
    .update(habits)
    .set({ activeFrom: today })
    .where(proposedHabitsFor(userId))
    .returning({ id: habits.id });
  return rows.length;
}

// Clear the proposed set before writing a fresh one, so re-generating replaces
// rather than stacks — and so a Part 3 retry that fires while a partial set
// exists can't double-write.
export async function clearProposedHabits(userId: UserId): Promise<number> {
  const rows = await db
    .delete(habits)
    .where(proposedHabitsFor(userId))
    .returning({ id: habits.id });
  return rows.length;
}

// Write a generator's output. One statement per habit rather than a multi-row
// insert, because each needs its own unique slug derived from its name.
export async function writeProposedHabits(
  userId: UserId,
  inputs: HabitInput[]
): Promise<number> {
  let written = 0;
  for (const input of inputs) {
    await createHabit(userId, input, {
      source: "ai_suggested",
      activeFrom: null,
    });
    written += 1;
  }
  return written;
}

// Habit ids by slug for the day/week/month queries, which still key on slug
// because the legacy renderers and `details` do.
export async function habitIdsBySlug(
  userId: UserId,
  slugs: string[]
): Promise<Record<string, number>> {
  if (slugs.length === 0) return {};
  const rows = await db
    .select({ id: habits.id, slug: habits.slug })
    .from(habits)
    .where(and(eq(habits.userId, userId), inArray(habits.slug, slugs)));
  return Object.fromEntries(rows.map((r) => [r.slug, r.id]));
}
