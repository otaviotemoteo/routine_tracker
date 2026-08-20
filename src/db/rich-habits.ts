// Read/write access for the six rich template kinds' `config` — scoped to a
// specific ACTIVITY, not "the account's one habit of a kind". See
// docs/ARCHITECTURE.md: two activities of the same kind, under
// the same habit or different ones, now coexist by construction — there is
// no more singleton to resolve, only the specific activity a caller already
// knows the id of.
//
// The shared rule, carried over from every one of the six old owner-shaped
// tables and then from habits.config: nothing in a list is ever hard-removed
// on save, only flagged `active: false` (or, for reading, only dropped once
// it has zero progress and was never started). Old `daily_checks.details`
// reference these items by id or slug, and ids/slugs are never reassigned
// once given out — a new id is always `max(existing) + 1` within that
// activity's own config, which is exactly the guarantee a serial primary
// key gave before.
import { getActivity, setActivityConfig } from "./habits";
import type { UserId } from "./scope";
import { parseConfig } from "@/lib/config-schemas";
import type {
  WorkoutConfig,
  ReadingConfig,
  SleepConfig,
  RoutineConfig,
  DuolingoConfig,
  SpiritualityConfig,
} from "@/lib/config-schemas";
import type { PlannedExercise } from "./schema";

function nextId(ids: number[]): number {
  return ids.length === 0 ? 1 : Math.max(...ids) + 1;
}

// ─── Workout ─────────────────────────────────────────────────────────────────

export interface WorkoutDay {
  id: number;
  weekday: number;
  focus: string;
  exercises: PlannedExercise[];
  active: boolean;
}

export interface WorkoutConfigResult {
  activityId: number;
  planName: string;
  // Every day ever planned, active and retired — callers filter to `active`
  // for "the current plan" and use the full list for old-day lookups.
  days: WorkoutDay[];
}

export async function getWorkoutConfig(
  userId: UserId,
  activityId: number
): Promise<WorkoutConfigResult | null> {
  const activity = await getActivity(userId, activityId);
  if (!activity || activity.templateKind !== "treino") return null;
  const cfg = (activity.config as WorkoutConfig | null) ?? { planName: "", days: [] };
  return { activityId: activity.id, planName: cfg.planName, days: cfg.days };
}

// Replaces the active plan: every previously-active day is kept but flagged
// inactive, and the submitted days become a new active set with fresh ids —
// the same "insert version+1, deactivate the rest" shape workout_plans used
// to have, minus the separate version-history table nothing ever read.
export async function saveWorkoutPlan(
  userId: UserId,
  activityId: number,
  planName: string,
  days: { weekday: number; focus: string; exercises: PlannedExercise[] }[]
): Promise<void> {
  const activity = await getActivity(userId, activityId);
  if (!activity) throw new Error("Activity not found");
  const existing = (activity.config as WorkoutConfig | null) ?? { planName: "", days: [] };
  const retired = existing.days.map((d) => ({ ...d, active: false }));
  let id = nextId(existing.days.map((d) => d.id));
  const active = days.map((d) => ({ id: id++, ...d, active: true }));
  const merged: WorkoutConfig = { planName, days: [...retired, ...active] };
  await setActivityConfig(userId, activityId, parseConfig("treino", merged));
}

// ─── Reading ─────────────────────────────────────────────────────────────────

export interface Book {
  id: number;
  title: string;
  author: string | null;
  totalPages: number;
  currentPage: number;
  status: "queued" | "reading" | "done" | "abandoned";
  position: number;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ReadingConfigResult {
  activityId: number;
  year: number;
  targetBooksPerYear: number;
  books: Book[];
}

export async function getReadingConfig(
  userId: UserId,
  activityId: number
): Promise<ReadingConfigResult | null> {
  const activity = await getActivity(userId, activityId);
  if (!activity || activity.templateKind !== "leitura") return null;
  const cfg = (activity.config as ReadingConfig | null) ?? {
    year: 0,
    targetBooksPerYear: 0,
    books: [],
  };
  return {
    activityId: activity.id,
    year: cfg.year,
    targetBooksPerYear: cfg.targetBooksPerYear,
    books: [...cfg.books].sort((a, b) => a.position - b.position),
  };
}

export async function listBooks(userId: UserId, activityId: number): Promise<Book[]> {
  const cfg = await getReadingConfig(userId, activityId);
  return cfg?.books ?? [];
}

export async function getCurrentBook(
  userId: UserId,
  activityId: number
): Promise<Book | null> {
  const books = await listBooks(userId, activityId);
  return books.find((b) => b.status === "reading") ?? null;
}

export async function getBookById(
  userId: UserId,
  activityId: number,
  id: number
): Promise<Book | null> {
  const books = await listBooks(userId, activityId);
  return books.find((b) => b.id === id) ?? null;
}

// Same reconciliation `saveReadingList` always did: a submitted row with an
// `id` replaces that book in place; a row with no `id` is a new book; an
// existing book that isn't resubmitted is dropped ONLY if it has zero
// progress and was never started (status queued/reading) — anything with
// progress, or status done/abandoned, survives regardless, because a past
// day's `details.book_id` may still name it.
export async function saveReadingList(
  userId: UserId,
  activityId: number,
  year: number,
  targetBooksPerYear: number,
  // No startedAt/finishedAt — the form has no field for either (see the
  // "updated" merge below, which is exactly why they're optional here).
  submitted: (Omit<Book, "id" | "startedAt" | "finishedAt"> & {
    id?: number;
  })[]
): Promise<void> {
  const activity = await getActivity(userId, activityId);
  if (!activity) throw new Error("Activity not found");
  const existing = (activity.config as ReadingConfig | null) ?? {
    year,
    targetBooksPerYear,
    books: [],
  };
  const keptIds = new Set(
    submitted.filter((b) => b.id !== undefined).map((b) => b.id)
  );
  const untouched = existing.books.filter(
    (b) =>
      !keptIds.has(b.id) &&
      !(b.currentPage === 0 && (b.status === "queued" || b.status === "reading"))
  );
  const existingById = new Map(existing.books.map((b) => [b.id, b]));
  let id = nextId(existing.books.map((b) => b.id));
  // The form has no field for startedAt/finishedAt (applyReadingProgress owns
  // those) — an update keeps whatever the book already had, same as the old
  // UPDATE statement only ever touching the columns it named.
  const updated = submitted
    .filter((b): b is Book & { id: number } => b.id !== undefined)
    .map((b) => ({
      ...(existingById.get(b.id) ?? { startedAt: null, finishedAt: null }),
      ...b,
    }));
  const added = submitted
    .filter((b) => b.id === undefined)
    .map((b) => ({ ...b, id: id++, startedAt: null, finishedAt: null }));
  const merged: ReadingConfig = {
    year,
    targetBooksPerYear,
    books: [...untouched, ...updated, ...added],
  };
  await setActivityConfig(userId, activityId, parseConfig("leitura", merged));
}

// Used by the daily check-in flow (applyReadingProgress in queries.ts) to
// move a book's current page — a targeted patch, not a full-list save.
export async function updateBook(
  userId: UserId,
  activityId: number,
  id: number,
  patch: {
    currentPage?: number;
    status?: Book["status"];
    startedAt?: string;
    finishedAt?: string;
  }
): Promise<void> {
  const activity = await getActivity(userId, activityId);
  if (!activity || activity.templateKind !== "leitura") return;
  const cfg = (activity.config as ReadingConfig | null) ?? {
    year: 0,
    targetBooksPerYear: 0,
    books: [],
  };
  const books = cfg.books.map((b) => (b.id === id ? { ...b, ...patch } : b));
  await setActivityConfig(userId, activityId, parseConfig("leitura", { ...cfg, books }));
}

// ─── Sleep ───────────────────────────────────────────────────────────────────

export interface SleepConfigResult {
  activityId: number;
  bedtime: string;
  wakeTime: string;
}

export async function getSleepConfig(
  userId: UserId,
  activityId: number
): Promise<SleepConfigResult | null> {
  const activity = await getActivity(userId, activityId);
  if (!activity || activity.templateKind !== "sono" || !activity.config) return null;
  const cfg = activity.config as SleepConfig;
  return { activityId: activity.id, bedtime: cfg.bedtime, wakeTime: cfg.wakeTime };
}

export async function saveSleepTarget(
  userId: UserId,
  activityId: number,
  bedtime: string,
  wakeTime: string
): Promise<void> {
  await setActivityConfig(userId, activityId, parseConfig("sono", { bedtime, wakeTime }));
}

// ─── Routine ─────────────────────────────────────────────────────────────────

export interface RoutineBlock {
  id: number;
  startTime: string;
  endTime: string;
  activity: string;
  weekdays: number[];
  position: number;
  active: boolean;
}

export async function getRoutineConfig(
  userId: UserId,
  activityId: number
): Promise<{ activityId: number; blocks: RoutineBlock[] } | null> {
  const activity = await getActivity(userId, activityId);
  if (!activity || activity.templateKind !== "rotina") return null;
  const cfg = (activity.config as RoutineConfig | null) ?? { blocks: [] };
  return { activityId: activity.id, blocks: cfg.blocks };
}

export async function listRoutineBlocks(
  userId: UserId,
  activityId: number,
  activeOnly = true
): Promise<RoutineBlock[]> {
  const cfg = await getRoutineConfig(userId, activityId);
  const blocks = cfg?.blocks ?? [];
  return (activeOnly ? blocks.filter((b) => b.active) : blocks).sort(
    (a, b) => a.position - b.position
  );
}

// Same shape `replaceRoutineBlocks` always had: every previously-active block
// is flagged inactive (never deleted — a past day's `struggled_block_id` may
// still name one), and the submitted set becomes the new active set with
// fresh ids. Called even with an empty list, which is how "clear the
// routine" works — same as before.
export async function saveRoutineBlocks(
  userId: UserId,
  activityId: number,
  blocks: {
    startTime: string;
    endTime: string;
    activity: string;
    weekdays: number[];
    position: number;
  }[]
): Promise<void> {
  const activity = await getActivity(userId, activityId);
  if (!activity) throw new Error("Activity not found");
  const existing = (activity.config as RoutineConfig | null) ?? { blocks: [] };
  const deactivated = existing.blocks.map((b) => ({ ...b, active: false }));
  let id = nextId(existing.blocks.map((b) => b.id));
  const active = blocks.map((b) => ({ id: id++, ...b, active: true }));
  const merged: RoutineConfig = { blocks: [...deactivated, ...active] };
  await setActivityConfig(userId, activityId, parseConfig("rotina", merged));
}

// ─── Duolingo (languages) ───────────────────────────────────────────────────

export interface Language {
  slug: string;
  name: string;
  active: boolean;
}

export async function getDuolingoConfig(
  userId: UserId,
  activityId: number
): Promise<{ activityId: number; languages: Language[] } | null> {
  const activity = await getActivity(userId, activityId);
  if (!activity || activity.templateKind !== "duolingo") return null;
  const cfg = (activity.config as DuolingoConfig | null) ?? { languages: [] };
  return { activityId: activity.id, languages: cfg.languages };
}

export async function listLanguages(
  userId: UserId,
  activityId: number,
  activeOnly = true
): Promise<Language[]> {
  const cfg = await getDuolingoConfig(userId, activityId);
  const languages = cfg?.languages ?? [];
  return activeOnly ? languages.filter((l) => l.active) : languages;
}

// Upsert by slug, same as `replaceLanguages`: every existing language is
// flagged inactive first, then each submitted item either reactivates the
// matching slug (in place — its id never changes) or is appended as new.
export async function saveLanguages(
  userId: UserId,
  activityId: number,
  items: { name: string; slug: string }[]
): Promise<void> {
  const activity = await getActivity(userId, activityId);
  if (!activity) throw new Error("Activity not found");
  const existing = (activity.config as DuolingoConfig | null) ?? { languages: [] };
  const bySlug = new Map(existing.languages.map((l) => [l.slug, { ...l, active: false }]));
  for (const item of items) {
    const prior = bySlug.get(item.slug);
    bySlug.set(item.slug, prior ? { ...prior, name: item.name, active: true } : { slug: item.slug, name: item.name, active: true });
  }
  const merged: DuolingoConfig = { languages: [...bySlug.values()] };
  await setActivityConfig(userId, activityId, parseConfig("duolingo", merged));
}

// ─── Spirituality ────────────────────────────────────────────────────────────

export interface Practice {
  slug: string;
  name: string;
  countable: boolean;
  position: number;
  active: boolean;
}

export async function getSpiritualityConfig(
  userId: UserId,
  activityId: number
): Promise<{ activityId: number; practices: Practice[] } | null> {
  const activity = await getActivity(userId, activityId);
  if (!activity || activity.templateKind !== "espiritualidade") return null;
  const cfg = (activity.config as SpiritualityConfig | null) ?? { practices: [] };
  return { activityId: activity.id, practices: cfg.practices };
}

export async function listSpiritualPractices(
  userId: UserId,
  activityId: number,
  activeOnly = true
): Promise<Practice[]> {
  const cfg = await getSpiritualityConfig(userId, activityId);
  const practices = cfg?.practices ?? [];
  return (activeOnly ? practices.filter((p) => p.active) : practices).sort(
    (a, b) => a.position - b.position
  );
}

// Upsert by slug, same as `replaceSpiritualPractices` — see saveLanguages.
export async function saveSpiritualPractices(
  userId: UserId,
  activityId: number,
  practices: { name: string; slug: string; countable: boolean; position: number }[]
): Promise<void> {
  const activity = await getActivity(userId, activityId);
  if (!activity) throw new Error("Activity not found");
  const existing = (activity.config as SpiritualityConfig | null) ?? { practices: [] };
  const bySlug = new Map(
    existing.practices.map((p) => [p.slug, { ...p, active: false }])
  );
  for (const p of practices) {
    bySlug.set(p.slug, {
      slug: p.slug,
      name: p.name,
      countable: p.countable,
      position: p.position,
      active: true,
    });
  }
  const merged: SpiritualityConfig = { practices: [...bySlug.values()] };
  await setActivityConfig(userId, activityId, parseConfig("espiritualidade", merged));
}
