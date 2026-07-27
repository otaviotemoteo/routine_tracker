import {
  pgTable,
  serial,
  varchar,
  boolean,
  date,
  integer,
  timestamp,
  text,
  time,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";

// ─── Tier 1: the spine (v1, unchanged) ──────────────────────────────────────

export const habits = pgTable("habits", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  icon: varchar("icon", { length: 10 }),
  optional: boolean("optional").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// One exercise inside a workout_plan_days.exercises array (entity config, not
// a daily log). Typed here; daily `details` shapes live in details-schemas.ts.
export interface PlannedExercise {
  name: string;
  sets?: number;
  reps?: number;
  load?: string;
}

export const dailyChecks = pgTable(
  "daily_checks",
  {
    id: serial("id").primaryKey(),
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
    unique().on(t.habitId, t.checkedAt),
    index("idx_checks_date").on(t.checkedAt.desc()),
  ]
);

// ─── Tier 3: entities (lifecycle beyond a single day) ────────────────────────

// Workout plans are immutable & versioned: editing = insert version+1, flip
// active. History is `SELECT * FROM workout_plans ORDER BY version`.
export const workoutPlans = pgTable("workout_plans", {
  id: serial("id").primaryKey(),
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

export const readingGoals = pgTable("reading_goals", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull().unique(),
  targetBooks: integer("target_books").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
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
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  activity: varchar("activity", { length: 120 }).notNull(),
  weekdays: integer("weekdays").array().notNull(), // ISO weekdays
  active: boolean("active").notNull().default(true),
  position: integer("position").notNull(),
});

export const spiritualPractices = pgTable("spiritual_practices", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  countable: boolean("countable").notNull().default(false),
  active: boolean("active").notNull().default(true),
  position: integer("position").notNull(),
});

export const languages = pgTable("languages", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  active: boolean("active").notNull().default(true),
});
