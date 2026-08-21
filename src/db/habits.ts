// Data access for habits AND activities. Sibling of queries.ts and
// assessment.ts, under the same two rules: every function takes the
// (branded) user id first, and every id-addressed write filters on the user
// too, so a foreign id matches no row rather than being mutated.
//
// See docs/ARCHITECTURE.md for the model this module implements.
// A habit is the umbrella (name, domain, lifecycle, no metric). An activity
// is the concrete, independently-checkable, independently-measured thing
// inside it (the metric spine, the template kind, its own lifecycle) — one
// or more per habit.
//
// The proposed/tracked split from before now exists at BOTH layers. A habit
// with `active_from IS NULL` has been written but not accepted — it exists
// so a 5–20s generation survives a refresh, invisible to every screen except
// the review one. An activity with `active_from IS NULL` carries the
// identical meaning, one layer down, for `activity_proposer`'s own slow
// calls. The filters live in src/db/scope.ts so no caller can forget them.
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { db } from "./index";
import {
  activities,
  dailyChecks,
  habits,
  lifeDomains,
  type HabitSource,
  type MetricType,
} from "./schema";
import {
  habitsFor,
  proposedActivitiesFor,
  proposedHabitsFor,
  type UserId,
} from "./scope";
import {
  RICH_TEMPLATE_KINDS,
  type GenericTemplateKind,
} from "@/lib/templates";
import type { DomainSlug } from "@/lib/domains";
import { slugify } from "@/lib/slugify";
import { addDays, calcStreak, todayInSaoPaulo } from "@/lib/utils";

export interface HabitRow {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  optional: boolean;
  domainId: number | null;
  domainSlug: DomainSlug | null;
  source: HabitSource;
  why: string | null;
  activeFrom: string | null;
  activeTo: string | null;
  position: number;
}

// What the form and the generator both produce for the umbrella itself.
export interface HabitInput {
  name: string;
  domainSlug: DomainSlug | null;
  why: string | null;
}

// What an EDIT may carry — exactly the fields the habit form shows.
//
// `why` is excluded, and the `?: never` mark is load-bearing, same as
// before: the form has no field for it, so a plain Omit would still
// structurally accept a full HabitInput and silently erase it on save. This
// makes passing one a compile error instead.
export type HabitEdit = Omit<HabitInput, "why"> & { why?: never };

const habitColumns = {
  id: habits.id,
  name: habits.name,
  slug: habits.slug,
  icon: habits.icon,
  optional: habits.optional,
  domainId: habits.domainId,
  domainSlug: lifeDomains.slug,
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

// ─── Habit reads ─────────────────────────────────────────────────────────────

// The tracked set: what the habits list and the umbrella pickers render.
export async function listHabits(
  userId: UserId,
  onDate?: string
): Promise<HabitRow[]> {
  const rows = await selectHabits()
    .where(habitsFor(userId, onDate))
    .orderBy(asc(habits.position), asc(habits.id));
  return rows.map(toRow);
}

// The proposed set: only the review screen reads this.
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

// ─── Activity reads ──────────────────────────────────────────────────────────

export interface ActivityRow {
  id: number;
  habitId: number;
  name: string;
  slug: string;
  metricType: MetricType;
  unit: string | null;
  target: number | null;
  minimalAction: string | null;
  templateKind: string | null;
  config: unknown;
  source: HabitSource;
  why: string | null;
  activeFrom: string | null;
  activeTo: string | null;
  position: number;
}

const activityColumns = {
  id: activities.id,
  habitId: activities.habitId,
  name: activities.name,
  slug: activities.slug,
  metricType: activities.metricType,
  unit: activities.unit,
  target: activities.target,
  minimalAction: activities.minimalAction,
  templateKind: activities.templateKind,
  config: activities.config,
  source: activities.source,
  why: activities.why,
  activeFrom: activities.activeFrom,
  activeTo: activities.activeTo,
  position: activities.position,
};

export async function getActivity(
  userId: UserId,
  id: number
): Promise<ActivityRow | null> {
  const [row] = await db
    .select(activityColumns)
    .from(activities)
    .where(and(eq(activities.id, id), eq(activities.userId, userId)));
  return row ?? null;
}

// Every activity under one habit, tracked or proposed — the /config habit
// expansion and the onboarding activities review both read this.
export async function listActivities(
  userId: UserId,
  habitId: number
): Promise<ActivityRow[]> {
  return db
    .select(activityColumns)
    .from(activities)
    .where(and(eq(activities.userId, userId), eq(activities.habitId, habitId)))
    .orderBy(asc(activities.position), asc(activities.id));
}

// Every TRACKED activity across every habit — Overview's Activities section
// and /config's habit list both build from this.
export async function listAllActivities(userId: UserId): Promise<ActivityRow[]> {
  return db
    .select(activityColumns)
    .from(activities)
    .where(and(eq(activities.userId, userId), isNotNull(activities.activeFrom)))
    .orderBy(asc(activities.position), asc(activities.id));
}

// The proposed set, optionally narrowed to one habit's own — only the
// activities review screen reads these.
export async function listProposedActivities(
  userId: UserId,
  habitId?: number
): Promise<ActivityRow[]> {
  return db
    .select(activityColumns)
    .from(activities)
    .where(proposedActivitiesFor(userId, habitId))
    .orderBy(asc(activities.position), asc(activities.id));
}

// An activity plus the umbrella fields a list/grouping screen needs — the
// habits list, the card-style chooser. Not carried by ActivityRow itself,
// which stays a plain per-table read.
export interface ActivityWithHabit extends ActivityRow {
  habitName: string;
  domainSlug: DomainSlug | null;
  optional: boolean;
}

// Every tracked activity, across every habit, in habit-then-activity order —
// the /habits list and the card-style chooser both read this rather than
// listHabits(), since the grain either screen actually shows is the
// activity now (see docs/ARCHITECTURE.md).
export async function listTrackedActivities(
  userId: UserId
): Promise<ActivityWithHabit[]> {
  const rows = await db
    .select({
      ...activityColumns,
      habitName: habits.name,
      domainSlug: lifeDomains.slug,
      optional: habits.optional,
    })
    .from(activities)
    .innerJoin(habits, eq(activities.habitId, habits.id))
    .leftJoin(lifeDomains, eq(habits.domainId, lifeDomains.id))
    .where(and(eq(activities.userId, userId), isNotNull(activities.activeFrom)))
    .orderBy(asc(habits.position), asc(activities.position), asc(activities.id));
  return rows.map((r) => ({
    ...r,
    domainSlug: (r.domainSlug as DomainSlug | null) ?? null,
  }));
}

// Current run of done days per ACTIVITY, keyed by id — the habits list's
// per-row streak figure. Deliberately not reused from getTodayComparisons,
// which answers the same question but also loads the richer Today-card
// payload; the habits list shows one figure per row and has no business
// paying for the rest of that.
const STREAK_WINDOW_DAYS = 400;

export async function getActivityStreaks(
  userId: UserId,
  today: string
): Promise<Record<number, number>> {
  const rows = await db
    .select({ activityId: dailyChecks.activityId, date: dailyChecks.checkedAt })
    .from(dailyChecks)
    .innerJoin(activities, eq(dailyChecks.activityId, activities.id))
    .where(
      and(
        eq(dailyChecks.userId, userId),
        eq(dailyChecks.done, true),
        gte(dailyChecks.checkedAt, addDays(today, -STREAK_WINDOW_DAYS)),
        lte(dailyChecks.checkedAt, today)
      )
    );

  const datesByActivity = new Map<number, Set<string>>();
  for (const row of rows) {
    const set = datesByActivity.get(row.activityId) ?? new Set<string>();
    set.add(row.date);
    datesByActivity.set(row.activityId, set);
  }

  const out: Record<number, number> = {};
  for (const [activityId, dates] of datesByActivity) {
    out[activityId] = calcStreak(dates, today);
  }
  return out;
}

// ─── Writes ──────────────────────────────────────────────────────────────────

// Slugs are per-account, shared across BOTH habits and activities — the
// checklist/generic renderers, /day?step=<slug> routing, and i18n's
// habitName() all key on slug within one account regardless of which table
// the row lives in, so the two must never collide.
async function uniqueSlug(
  userId: UserId,
  name: string,
  exceptId?: { table: "habit" | "activity"; id: number }
): Promise<string> {
  const base =
    slugify(name).slice(0, 40) || `habit-${Date.now().toString(36)}`;
  const [habitSlugs, activitySlugs] = await Promise.all([
    db.select({ slug: habits.slug }).from(habits).where(eq(habits.userId, userId)),
    db.select({ slug: activities.slug }).from(activities).where(eq(activities.userId, userId)),
  ]);
  const used = new Set([
    ...habitSlugs.map((r) => r.slug),
    ...activitySlugs.map((r) => r.slug),
  ]);
  if (exceptId) {
    const table = exceptId.table === "habit" ? habits : activities;
    const [current] = await db
      .select({ slug: table.slug })
      .from(table)
      .where(and(eq(table.id, exceptId.id), eq(table.userId, userId)));
    if (current) used.delete(current.slug);
  }
  if (!used.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

async function domainIdFor(slug: DomainSlug | null): Promise<number | null> {
  if (!slug) return null;
  const [row] = await db
    .select({ id: lifeDomains.id })
    .from(lifeDomains)
    .where(eq(lifeDomains.slug, slug));
  return row?.id ?? null;
}

async function insertHabitRow(
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
      source: options.source,
      why: input.why,
      activeFrom: options.activeFrom,
      position: Number(max) + 1,
    })
    .returning({ id: habits.id });
  return row.id;
}

// What a new activity's metric spine looks like, whoever creates it — the
// habit form (a plain, human-made activity), the generator (a plain
// AI-suggested one), or the AI activities proposer (a rich one).
export interface ActivityCreateInput {
  name: string;
  metricType: MetricType;
  unit: string | null;
  target: number | null;
  minimalAction: string | null;
  templateKind: string | null;
  config: unknown;
}

// Insert ONE NEW activity under a specific habit — never an update, never a
// "find or reuse the account's one of this kind". Decision 3
// (docs/ARCHITECTURE.md): generation always creates, so two
// activities that want the same kind can never silently merge.
export async function createActivity(
  userId: UserId,
  habitId: number,
  input: ActivityCreateInput,
  options: { source: HabitSource; why: string | null; activeFrom: string | null }
): Promise<number> {
  const [habit] = await db
    .select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));
  if (!habit) throw new Error("Habit not found");

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${activities.position}), 0)` })
    .from(activities)
    .where(eq(activities.habitId, habitId));

  const [row] = await db
    .insert(activities)
    .values({
      userId,
      habitId,
      name: input.name,
      slug: await uniqueSlug(userId, input.name),
      metricType: input.metricType,
      unit: input.unit,
      target: input.target,
      minimalAction: input.minimalAction,
      templateKind: input.templateKind,
      config: input.config,
      source: options.source,
      why: options.why,
      activeFrom: options.activeFrom,
      position: Number(max) + 1,
    })
    .returning({ id: activities.id });
  return row.id;
}

// The metric spine for a habit's DEFAULT activity — see the default-activity
// invariant in docs/ARCHITECTURE.md: every tracked habit gets
// exactly one of these the moment it becomes tracked.
export interface DefaultActivityInput {
  metricType: MetricType;
  unit: string | null;
  target: number | null;
  minimalAction: string | null;
}

// Create a habit AND its one default activity together. `activeFrom` decides
// which of the two sets both land in: a date means tracked immediately (the
// manual form), null means proposed (the generator, and anything added on
// the review screen alongside it). The default activity is always plain
// (`templateKind: null`) — SUGGESTABLE_TEMPLATE_KINDS has exactly one
// member, and a human-made habit's form has no rich-kind picker either.
export async function createHabit(
  userId: UserId,
  input: HabitInput,
  activityInput: DefaultActivityInput,
  options: { source: HabitSource; activeFrom: string | null }
): Promise<{ habitId: number; activityId: number }> {
  const habitId = await insertHabitRow(userId, input, options);
  const activityId = await createActivity(
    userId,
    habitId,
    {
      name: input.name,
      metricType: activityInput.metricType,
      unit: activityInput.unit,
      target: activityInput.target,
      minimalAction: activityInput.minimalAction,
      templateKind: null,
      config: null,
    },
    { source: options.source, why: null, activeFrom: options.activeFrom }
  );
  return { habitId, activityId };
}

// Overwrites an activity's `config` wholesale. The caller (rich-habits.ts)
// has already validated the new shape against config-schemas.ts and merged
// it with whatever the old config needs kept (inactive list entries,
// mostly) — this function just writes what it's handed, scoped to the
// account.
export async function setActivityConfig(
  userId: UserId,
  activityId: number,
  config: unknown
): Promise<void> {
  await db
    .update(activities)
    .set({ config })
    .where(and(eq(activities.id, activityId), eq(activities.userId, userId)));
}

// Sets an activity's card style — the /habits/templates chooser's one write,
// now scoped to an activity rather than a habit.
//
// `config` is optional and normally omitted: only the `checklist` kind has
// anything to store there, and an activity that picks it, tries something
// else, then picks it again should find its items still named — so
// switching to any OTHER kind leaves a previous checklist's config alone
// rather than clearing it.
//
// The WHERE clause is a second guard behind the UI, which never offers this
// action on an activity that already has one of the six rich kinds: that
// kind's real setup lives in `config` too, and this function's simple
// callers never collect one — overwriting it would silently orphan a
// workout plan or a reading list an activity already has.
export async function setActivityTemplate(
  userId: UserId,
  id: number,
  kind: GenericTemplateKind,
  config?: unknown
): Promise<boolean> {
  const rows = await db
    .update(activities)
    .set({
      templateKind: kind,
      ...(config !== undefined ? { config } : {}),
    })
    .where(
      and(
        eq(activities.id, id),
        eq(activities.userId, userId),
        or(
          isNull(activities.templateKind),
          notInArray(activities.templateKind, [...RICH_TEMPLATE_KINDS])
        )
      )
    )
    .returning({ id: activities.id });
  return rows.length > 0;
}

// What an ACTIVITY edit may carry — the metric section HabitForm lost.
// `templateKind`/`config` are excluded via `?: never`, the same load-bearing
// guard HabitEdit uses: the generic activity-edit form has no controls for
// either, so a naive update must not be able to silently reset a rich
// activity to plain.
export type ActivityEdit = {
  name: string;
  metricType: MetricType;
  unit: string | null;
  target: number | null;
  minimalAction: string | null;
  templateKind?: never;
  config?: never;
};

export async function updateActivity(
  userId: UserId,
  id: number,
  input: ActivityEdit
): Promise<boolean> {
  const rows = await db
    .update(activities)
    .set({
      name: input.name,
      metricType: input.metricType,
      unit: input.unit,
      target: input.target,
      minimalAction: input.minimalAction,
      source: sql`CASE WHEN ${activities.source} = 'ai_suggested'
                       THEN 'ai_edited' ELSE ${activities.source} END`,
    })
    .where(and(eq(activities.id, id), eq(activities.userId, userId)))
    .returning({ id: activities.id });
  return rows.length > 0;
}

// Update a habit's wording. Never touches active_from, so editing a proposal
// leaves it a proposal and editing a tracked habit leaves it tracked.
export async function updateHabit(
  userId: UserId,
  id: number,
  input: HabitEdit
): Promise<boolean> {
  const rows = await db
    .update(habits)
    .set({
      name: input.name,
      domainId: await domainIdFor(input.domainSlug),
      source: sql`CASE WHEN ${habits.source} = 'ai_suggested'
                       THEN 'ai_edited' ELSE ${habits.source} END`,
    })
    .where(and(eq(habits.id, id), eq(habits.userId, userId)))
    .returning({ id: habits.id });
  return rows.length > 0;
}

// Remove, which means two different things depending on the set — exactly
// as before, now fanned out to the habit's own activities too:
//
//   proposed (active_from IS NULL)  DELETE, activities included. Nothing
//                                   reaches /config or the activities
//                                   generator before "Start tracking", so a
//                                   proposed habit's activities are always
//                                   themselves still proposed — genuinely
//                                   disposable, same as the habit itself.
//
//   tracked                         set active_to on the habit AND on every
//                                   one of its still-active activities.
//                                   Never delete: daily_checks reference
//                                   them, and an activity you kept for three
//                                   months is part of the record even after
//                                   you stop.
export async function removeHabit(
  userId: UserId,
  id: number,
  today: string
): Promise<boolean> {
  const [target] = await db
    .select({ id: habits.id, activeFrom: habits.activeFrom })
    .from(habits)
    .where(and(eq(habits.id, id), eq(habits.userId, userId)));
  if (!target) return false;

  if (target.activeFrom === null) {
    await db
      .delete(activities)
      .where(and(eq(activities.habitId, id), eq(activities.userId, userId)));
    const deleted = await db
      .delete(habits)
      .where(
        and(eq(habits.id, id), eq(habits.userId, userId), isNull(habits.activeFrom))
      )
      .returning({ id: habits.id });
    return deleted.length > 0;
  }

  const archived = await db
    .update(habits)
    .set({ activeTo: today })
    .where(
      and(eq(habits.id, id), eq(habits.userId, userId), isNull(habits.activeTo))
    )
    .returning({ id: habits.id });
  if (archived.length > 0) {
    await db
      .update(activities)
      .set({ activeTo: today })
      .where(
        and(
          eq(activities.habitId, id),
          eq(activities.userId, userId),
          isNotNull(activities.activeFrom),
          isNull(activities.activeTo)
        )
      );
  }
  return archived.length > 0;
}

// Remove ONE activity — the leaf, so no fan-out (compare removeHabit, which
// cascades to its activities). Same two paths: delete a still-proposed one
// outright (nothing can reference it yet), archive a tracked one (daily
// checks reference it; never delete a row they point at).
export async function removeActivity(
  userId: UserId,
  id: number,
  today: string
): Promise<boolean> {
  const deleted = await db
    .delete(activities)
    .where(
      and(
        eq(activities.id, id),
        eq(activities.userId, userId),
        isNull(activities.activeFrom)
      )
    )
    .returning({ id: activities.id });
  if (deleted.length > 0) return true;

  const archived = await db
    .update(activities)
    .set({ activeTo: today })
    .where(
      and(
        eq(activities.id, id),
        eq(activities.userId, userId),
        isNull(activities.activeTo)
      )
    )
    .returning({ id: activities.id });
  return archived.length > 0;
}

// "Start tracking": the whole proposed set becomes real in one statement,
// habit AND its default activity together. Returns how many habits, so the
// caller can tell an empty press from a real one.
export async function activateProposedHabits(
  userId: UserId,
  today: string
): Promise<number> {
  const rows = await db
    .update(habits)
    .set({ activeFrom: today })
    .where(proposedHabitsFor(userId))
    .returning({ id: habits.id });
  if (rows.length > 0) {
    await db
      .update(activities)
      .set({ activeFrom: today })
      .where(
        and(
          eq(activities.userId, userId),
          isNull(activities.activeFrom),
          inArray(activities.habitId, rows.map((r) => r.id))
        )
      );
  }
  return rows.length;
}

// Accept every still-proposed ACTIVITY for this account in one statement —
// the onboarding activities review screen's one write. Runs the
// placeholder-retirement guard (docs/ARCHITECTURE.md) for every
// habit touched: a still-untouched plain default activity is retired, never
// deleted, the first time a real activity is accepted for its habit — but
// only if it has no logged history of its own.
export async function acceptProposedActivities(
  userId: UserId,
  today: string
): Promise<number> {
  const proposed = await db
    .select({ id: activities.id, habitId: activities.habitId })
    .from(activities)
    .where(proposedActivitiesFor(userId));
  if (proposed.length === 0) return 0;

  await db
    .update(activities)
    .set({ activeFrom: today })
    .where(proposedActivitiesFor(userId));

  const habitIds = [...new Set(proposed.map((p) => p.habitId))];
  for (const habitId of habitIds) {
    const acceptedIds = proposed.filter((p) => p.habitId === habitId).map((p) => p.id);
    const candidates = await db
      .select({ id: activities.id })
      .from(activities)
      .where(
        and(
          eq(activities.habitId, habitId),
          eq(activities.userId, userId),
          notInArray(activities.id, acceptedIds),
          isNull(activities.templateKind),
          isNotNull(activities.activeFrom),
          isNull(activities.activeTo)
        )
      );
    for (const candidate of candidates) {
      const [hasHistory] = await db
        .select({ id: dailyChecks.id })
        .from(dailyChecks)
        .where(and(eq(dailyChecks.activityId, candidate.id), eq(dailyChecks.done, true)))
        .limit(1);
      if (!hasHistory) {
        // Yesterday, not today: the replacement's activeFrom is `today`, and
        // activitiesFor()'s activeTo bound is inclusive (a normal removal's
        // "still counts through the day you deleted it" rule) — setting the
        // retiring placeholder's activeTo to `today` too would make both
        // rows live for the exact same day, which is the literal duplicate-
        // card bug this line used to cause when a habit got a second
        // activity generated the same day its first was accepted.
        await db
          .update(activities)
          .set({ activeTo: addDays(today, -1) })
          .where(eq(activities.id, candidate.id));
      }
    }
  }
  return proposed.length;
}

// Clear the proposed habit set before writing a fresh one, so re-generating
// replaces rather than stacks — and so a retry that fires while a partial
// set exists can't double-write. Each proposed habit's proposed activities
// go with it, for the same reason removeHabit's delete path does.
export async function clearProposedHabits(userId: UserId): Promise<number> {
  const proposedIds = await db
    .select({ id: habits.id })
    .from(habits)
    .where(proposedHabitsFor(userId));
  if (proposedIds.length > 0) {
    await db
      .delete(activities)
      .where(
        and(
          eq(activities.userId, userId),
          inArray(activities.habitId, proposedIds.map((h) => h.id))
        )
      );
  }
  const rows = await db
    .delete(habits)
    .where(proposedHabitsFor(userId))
    .returning({ id: habits.id });
  return rows.length;
}

// Write a generator's output: one habit AND its default activity per input.
export async function writeProposedHabits(
  userId: UserId,
  inputs: (HabitInput & DefaultActivityInput)[]
): Promise<number> {
  let written = 0;
  for (const input of inputs) {
    await createHabit(
      userId,
      { name: input.name, domainSlug: input.domainSlug, why: input.why },
      {
        metricType: input.metricType,
        unit: input.unit,
        target: input.target,
        minimalAction: input.minimalAction,
      },
      { source: "ai_suggested", activeFrom: null }
    );
    written += 1;
  }
  return written;
}

// Habit ids by slug for legacy lookups that still key on slug.
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
