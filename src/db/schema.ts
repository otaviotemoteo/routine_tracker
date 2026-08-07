import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  varchar,
  boolean,
  check,
  date,
  integer,
  timestamp,
  text,
  time,
  jsonb,
  unique,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ─── Tier 0: accounts ────────────────────────────────────────────────────────

// Login is a name, not an email: nothing is ever sent to a user, so an address
// would be an unverifiable field to maintain. `handle` is the lowercased name
// and carries the uniqueness, so "Sofia" and "sofia" are the same person.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 40 }).notNull(),
  handle: varchar("handle", { length: 40 }).notNull().unique(),
  // PBKDF2-SHA256, "iterations.saltHex.hashHex" — see src/lib/password.ts.
  // NULL means the account exists but has never been signed into: the first
  // person to log in with this name sets the password. Accounts are only ever
  // created by script, never by the UI or the API.
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Tier 1: the spine ───────────────────────────────────────────────────────

// Habits stay a shared catalogue: everyone tracks the same seven for now.
// (When activities become user-defined, this grows a user_id like the rest.)
export const habits = pgTable("habits", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  icon: varchar("icon", { length: 10 }),
  optional: boolean("optional").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// How an exercise is measured. Not everything is sets×reps: a run is a
// distance (and maybe a target time), a plank is sets × a hold in seconds.
export type ExerciseKind = "reps" | "time" | "distance";

// One exercise inside a workout_plan_days.exercises array (entity config, not
// a daily log). Typed here; daily `details` shapes live in details-schemas.ts.
export interface PlannedExercise {
  name: string;
  // Absent means "reps" — the shape every pre-v2.2 row was written with.
  kind?: ExerciseKind;
  sets?: number;
  reps?: number; // kind "reps"
  seconds?: number; // kind "time" — hold/effort per set
  distance?: number; // kind "distance" — kilometres
  minutes?: number; // kind "distance" — optional target time
  load?: string;
}

export const dailyChecks = pgTable(
  "daily_checks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    habitId: integer("habit_id")
      .notNull()
      .references(() => habits.id),
    // NO database default on purpose (timezone rule) — see src/lib/utils.ts.
    checkedAt: date("checked_at").notNull(),
    done: boolean("done").notNull().default(false),
    // Tier 2: habit-specific granular answers, validated by a Zod schema in
    // src/lib/details-schemas.ts on every write. NULL = "done without details"
    // (v1 rows and quick-toggle days), valid forever.
    details: jsonb("details"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique().on(t.userId, t.habitId, t.checkedAt),
    index("idx_checks_user_date").on(t.userId, t.checkedAt.desc()),
  ]
);

// ─── Tier 3: entities (lifecycle beyond a single day) ────────────────────────

// Workout plans are immutable & versioned: editing = insert version+1, flip
// active. History is `SELECT * FROM workout_plans ORDER BY version`.
export const workoutPlans = pgTable("workout_plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  version: integer("version").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const workoutPlanDays = pgTable("workout_plan_days", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id")
    .notNull()
    .references(() => workoutPlans.id),
  weekday: integer("weekday").notNull(), // ISO: 1=Mon … 7=Sun
  focus: varchar("focus", { length: 80 }).notNull(), // "Push", "Rest", "Cardio"
  exercises: jsonb("exercises")
    .$type<PlannedExercise[]>()
    .notNull()
    .default([]),
});

export const readingGoals = pgTable(
  "reading_goals",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    year: integer("year").notNull(),
    targetBooks: integer("target_books").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.userId, t.year)]
);

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: varchar("title", { length: 200 }).notNull(),
  author: varchar("author", { length: 120 }),
  totalPages: integer("total_pages").notNull(),
  status: varchar("status", { length: 12 }).notNull().default("queued"),
  // 'queued' | 'reading' | 'done' | 'abandoned'
  currentPage: integer("current_page").notNull().default(0),
  position: integer("position").notNull(), // order in the reading list
  startedAt: date("started_at"),
  finishedAt: date("finished_at"),
});

export const routineBlocks = pgTable("routine_blocks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  activity: varchar("activity", { length: 120 }).notNull(),
  weekdays: integer("weekdays").array().notNull(), // ISO weekdays
  active: boolean("active").notNull().default(true),
  position: integer("position").notNull(),
});

export const spiritualPractices = pgTable(
  "spiritual_practices",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    countable: boolean("countable").notNull().default(false),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull(),
  },
  (t) => [unique().on(t.userId, t.slug)]
);

export const languages = pgTable(
  "languages",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 50 }).notNull(),
    slug: varchar("slug", { length: 50 }).notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [unique().on(t.userId, t.slug)]
);

// Sleep targets (single row): the planned bedtime/wake used to derive the
// default hours for the daily sleep stepper. Not referenced by `details`.
export const sleepTargets = pgTable("sleep_targets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  bedtime: time("bedtime").notNull(),
  wakeTime: time("wake_time").notNull(),
});

// ─── Tier 4: the values layer ────────────────────────────────────────────────
//
// Where the tracker records what you did, this records what you said mattered.
// It is append-only by design: the one question that justifies the whole thing
// existing is "what did I say I'd do, and what happened?", and you cannot
// answer it in a system that lets you edit the past.

// The twelve life domains, seeded once and shared by everyone — a fixed
// vocabulary, like `habits`. Deliberately carries no display text: names and
// descriptions live in src/lib/i18n-assessment.ts, keyed by this slug, because
// the app is bilingual.
export const lifeDomains = pgTable("life_domains", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 40 }).notNull().unique(),
  position: integer("position").notNull(), // fixed order, never randomised
});

// A planning period ("2026-H2"). Derived from the date, never created by hand:
// there is no cycle UI and there doesn't need to be one.
export const cycles = pgTable(
  "cycles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    label: varchar("label", { length: 20 }).notNull(),
    startsAt: date("starts_at").notNull(),
    endsAt: date("ends_at").notNull(),
    status: varchar("status", { length: 10 }).notNull().default("active"),
    // 'draft' | 'active' | 'closed'
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.userId, t.label)]
);

// One filling-in of the grid.
//
// Mutable while `completedAt IS NULL` (a draft you can walk back through) and
// sealed forever the moment it is set. That is how append-only and "every step
// saves on advance, abandoning midway loses nothing" both hold: a draft simply
// isn't the record yet. Every write to a rating carries the same predicate.
export const assessments = pgTable(
  "assessments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    cycleId: integer("cycle_id")
      .notNull()
      .references(() => cycles.id),
    // NO database default (timezone rule) — see src/lib/utils.ts.
    takenAt: date("taken_at").notNull(),
    kind: varchar("kind", { length: 10 }).notNull().default("full"),
    // 'full' (12 domains) | 'checkin' (priority domains only)
    contextNote: text("context_note"), // "done in the morning, tired"
    // The priority cut, frozen at sealing time as domain slugs. Recomputing it
    // on read would let a later change to THRESHOLDS silently rewrite which
    // domains a past cycle prioritised, while its direction narratives sat
    // attached to domains no longer in the list.
    priorityDomains: varchar("priority_domains", { length: 40 })
      .array()
      .notNull()
      .default([]),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Set when an assessment was sealed in error. Never deleted, never edited,
    // just excluded from reads — the recourse that stops a near-duplicate from
    // polluting the series.
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    // One open draft per person, enforced by the database rather than hoped
    // for: it makes "two half-filled grids" unrepresentable and lets the draft
    // be fetched with a plain upsert.
    uniqueIndex("assessments_one_open_draft")
      .on(t.userId)
      .where(sql`${t.completedAt} IS NULL`),
    index("idx_assessments_user_taken").on(t.userId, t.takenAt.desc()),
  ]
);

// Six numbers for one domain. No user_id: it reaches its owner through
// assessment_id, exactly as workout_plan_days does through plan_id.
export const assessmentRatings = pgTable(
  "assessment_ratings",
  {
    id: serial("id").primaryKey(),
    assessmentId: integer("assessment_id")
      .notNull()
      .references(() => assessments.id),
    domainId: integer("domain_id")
      .notNull()
      .references(() => lifeDomains.id),
    possibility: integer("possibility").notNull(),
    importanceNow: integer("importance_now").notNull(),
    importanceGeneral: integer("importance_general").notNull(),
    action: integer("action").notNull(),
    actionSatisfaction: integer("action_satisfaction").notNull(),
    concern: integer("concern").notNull(),
  },
  (t) => [
    unique().on(t.assessmentId, t.domainId),
    // One check per column rather than one combined check, so a violation
    // names the column that broke.
    check("rating_possibility_range", sql`${t.possibility} BETWEEN 1 AND 10`),
    check("rating_importance_now_range", sql`${t.importanceNow} BETWEEN 1 AND 10`),
    check(
      "rating_importance_general_range",
      sql`${t.importanceGeneral} BETWEEN 1 AND 10`
    ),
    check("rating_action_range", sql`${t.action} BETWEEN 1 AND 10`),
    check(
      "rating_action_satisfaction_range",
      sql`${t.actionSatisfaction} BETWEEN 1 AND 10`
    ),
    check("rating_concern_range", sql`${t.concern} BETWEEN 1 AND 10`),
  ]
);

// The one sentence describing where you want to move in a domain this cycle,
// plus the free writing it came out of. Written for the priority domains only.
export const directionNarratives = pgTable(
  "direction_narratives",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    cycleId: integer("cycle_id")
      .notNull()
      .references(() => cycles.id),
    domainId: integer("domain_id")
      .notNull()
      .references(() => lifeDomains.id),
    rawReflection: text("raw_reflection"), // the long answer
    narrative: text("narrative"), // the one sentence
    // 'human' | 'ai_suggested' | 'ai_edited'. Always 'human' today; the column
    // exists now so that adding generated drafts later needs no backfill.
    source: varchar("source", { length: 12 }).notNull().default("human"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.cycleId, t.domainId)]
);
