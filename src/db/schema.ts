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
  // Churn auditing, and the whole of it: the step of the first run this
  // account last advanced past. Written on every advance and set back to NULL
  // when the run completes, so any non-null value IS an abandonment and the
  // happy path leaves nothing behind. Vocabulary in src/lib/first-run.ts.
  //
  //   SELECT first_run_step, count(*) FROM users
  //    WHERE first_run_step IS NOT NULL GROUP BY 1;
  firstRunStep: varchar("first_run_step", { length: 30 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Tier 1: the spine ───────────────────────────────────────────────────────

// How a habit is measured. The universal spine: every habit, for every person,
// reduces to one of these three, and that reduction is what lets the grid,
// the streak and the adherence maths be written once.
export type MetricType = "binary" | "count" | "duration";

// Where a habit's wording came from. Mirrors direction_narratives.source, and
// is what makes the rejection rate of a generator a query rather than a guess.
export type HabitSource = "human" | "ai_suggested" | "ai_edited";

// Habits are per-user. They used to be a shared catalogue of seven rows with a
// globally unique slug, which is the modelling error that stopped anyone else
// from using the app: it normalised what is *personal* into schema.
//
// A habit is the UMBRELLA — see docs/HABIT-VS-ACTIVITY-MODEL.md. It carries no
// metric and no template of its own; those live on `activities` below, one or
// more per habit. The one column here that still carries real meaning:
//
//   active_from    NULL means PROPOSED, not yet tracked. A generated habit is
//                  written immediately (so a 5–20s call survives a refresh)
//                  but stays invisible to every user-facing read until "Start
//                  tracking" sets this. habitsFor() in src/db/scope.ts is the
//                  single place that filter lives.
export const habits = pgTable(
  "habits",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 50 }).notNull(),
    // Unique per account, not globally: two people may both track "leitura".
    slug: varchar("slug", { length: 50 }).notNull(),
    icon: varchar("icon", { length: 10 }),
    optional: boolean("optional").notNull().default(false),

    // ── The seam into the planning layer ──
    // The life area this habit descends from. Nullable: a habit added by hand
    // before any assessment is "not yet anchored to a value", which is itself
    // useful data rather than an error.
    domainId: integer("domain_id").references(() => lifeDomains.id),
    // No FK yet — there is no `goals` table. The column exists now so goals
    // slot in later without touching a single habit row.
    goalId: integer("goal_id"),

    // ── DEAD, kept for a rollback window — see src/db/migrate-activities.ts ──
    // Moved to `activities` (the metric spine and the template layer both
    // belong to the concrete, checkable thing, not the umbrella — see
    // docs/HABIT-VS-ACTIVITY-MODEL.md). No application code reads or writes
    // these six columns any more; they stay physically present, untouched,
    // until migrate-activities-cleanup.ts drops them once the new grain has
    // run in production without incident.
    metricType: varchar("metric_type", { length: 10 })
      .$type<MetricType>()
      .notNull()
      .default("binary"),
    unit: varchar("unit", { length: 20 }),
    target: integer("target"),
    minimalAction: varchar("minimal_action", { length: 200 }),
    templateKind: varchar("template_kind", { length: 30 }),
    config: jsonb("config"),

    // ── Provenance ──
    source: varchar("source", { length: 12 })
      .$type<HabitSource>()
      .notNull()
      .default("human"),
    why: text("why"), // the one line a suggestion gave for proposing it

    // ── Lifecycle ──
    activeFrom: date("active_from"), // NULL = proposed (see above)
    activeTo: date("active_to"), // set on remove; the row is never deleted
    position: integer("position").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique().on(t.userId, t.slug),
    index("idx_habits_user_position").on(t.userId, t.position),
    check(
      "habits_metric_type",
      sql`${t.metricType} IN ('binary', 'count', 'duration')`
    ),
    check(
      "habits_source",
      sql`${t.source} IN ('human', 'ai_suggested', 'ai_edited')`
    ),
  ]
);

// The ACTIVITY — the concrete, independently-checkable, independently-
// measured thing living inside a habit. See docs/HABIT-VS-ACTIVITY-MODEL.md
// for the full model; the short version:
//
//   Every tracked habit has exactly one activity from the moment it becomes
//   tracked (the default-activity invariant) — `template_kind: null`,
//   carrying whatever metric fields the habit form or the generator gave it.
//   A habit MAY have more than one ("Cuidado com o corpo" with both a
//   "Treino" and a "Corrida" activity), each independently checkable, never
//   merged — see "Decision 3" in the model doc.
//
// `source`, `why`, `active_from`/`active_to` mirror `habits`' own columns,
// one layer down, for the identical reason: `activity_proposer` calls run
// tens of seconds to minutes (docs/BLOCKED.md), so a proposal a person
// hasn't reviewed yet must survive a refresh exactly as a proposed habit
// already does.
export const activities = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    // Denormalized, deliberately, matching every other per-user table here
    // (habits, daily_checks): scope predicates and the branded UserId
    // discipline in src/db/scope.ts work without an extra join.
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    habitId: integer("habit_id")
      .notNull()
      .references(() => habits.id),

    // The card's own label ("Treino", "Corrida") — distinct from the
    // umbrella habit's name the moment a habit has more than one activity.
    name: varchar("name", { length: 50 }).notNull(),
    // Unique per account, not globally, mirroring habits.slug. Drives
    // /day?step=<slug> routing, i18n's habitName() lookup, and the export's
    // per-entity key.
    slug: varchar("slug", { length: 50 }).notNull(),

    // ── The metric spine (moved from habits) ──
    metricType: varchar("metric_type", { length: 10 })
      .$type<MetricType>()
      .notNull()
      .default("binary"),
    unit: varchar("unit", { length: 20 }), // "pages", "minutes", "lessons"
    target: integer("target"),
    minimalAction: varchar("minimal_action", { length: 200 }),

    // ── Template layer (moved from habits) ──
    templateKind: varchar("template_kind", { length: 30 }),
    config: jsonb("config"), // never written by a model — see src/lib/ai/

    // ── Provenance ──
    // Reuses HabitSource — same three values, same meaning, one layer down.
    source: varchar("source", { length: 12 })
      .$type<HabitSource>()
      .notNull()
      .default("human"),
    // The one-line reason a suggestion gave, OR the per-activity "briefing" a
    // person types on /onboarding/activities or /config's "add an activity" —
    // never a copy of the parent habit's own `why`.
    why: text("why"),

    // ── Lifecycle ──
    activeFrom: date("active_from"), // NULL = proposed, not yet accepted
    activeTo: date("active_to"), // set on remove; the row is never deleted
    position: integer("position").notNull().default(0), // order within a habit

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique().on(t.userId, t.slug),
    index("idx_activities_user_position").on(t.userId, t.position),
    index("idx_activities_habit").on(t.habitId, t.position),
    check(
      "activities_metric_type",
      sql`${t.metricType} IN ('binary', 'count', 'duration')`
    ),
    check(
      "activities_source",
      sql`${t.source} IN ('human', 'ai_suggested', 'ai_edited')`
    ),
  ]
);

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
    // The grain: one check per ACTIVITY per day, not per habit — see
    // docs/HABIT-VS-ACTIVITY-MODEL.md. A habit with two activities produces
    // two independent checks, two independent streaks, two Today cards.
    activityId: integer("activity_id")
      .notNull()
      .references(() => activities.id),
    // DEAD, kept nullable for a rollback window — see
    // src/db/migrate-activities.ts. Historical rows keep their old value for
    // inspection; no application code writes this on a new row any more, so
    // it is NOT NULL no longer. Dropped by migrate-activities-cleanup.ts.
    habitId: integer("habit_id").references(() => habits.id),
    // NO database default on purpose (timezone rule) — see src/lib/utils.ts.
    checkedAt: date("checked_at").notNull(),
    done: boolean("done").notNull().default(false),
    // Tier 2: activity-specific granular answers, validated by a Zod schema
    // in src/lib/details-schemas.ts on every write. NULL = "done without
    // details" (v1 rows and quick-toggle days), valid forever.
    details: jsonb("details"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique().on(t.userId, t.activityId, t.checkedAt),
    index("idx_checks_user_date").on(t.userId, t.checkedAt.desc()),
  ]
);

// ─── Tier 3: an activity's own setup ───────────────────────────────────────────
//
// Through Phase 3 this was six account-wide singleton tables — workout_plans
// (+_days), reading_goals, books, routine_blocks, spiritual_practices,
// languages, sleep_targets. Phase 3 folded them into the owning HABIT's own
// `config` column; this phase moved `config` (and the metric spine beside it)
// one layer down again, onto `activities` above, so more than one activity
// can carry the same template kind without one promotion overwriting
// another's setup. Shaped by src/lib/config-schemas.ts, read/written through
// src/db/rich-habits.ts. See docs/HABIT-VS-ACTIVITY-MODEL.md for the model,
// docs/ARCHITECTURE.md's "Rich habits become per-habit (Phase 3)" for how it
// got to habits in the first place, and src/db/migrate-activities.ts for how
// it moved from habits to activities without losing an id or a slug.

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

// ─── Tier 5: the AI harness ──────────────────────────────────────────────────

// What a generator call ended as. The same four the harness returns, so a row
// is readable without knowing the code:
//   ok           a valid, schema-shaped answer came back
//   unavailable  decided BEFORE any I/O — no key, or the day's quota is spent
//   invalid      the provider answered, but the shape was wrong
//   error        network, timeout, 5xx, rate limit
export type AiOutcome = "ok" | "unavailable" | "invalid" | "error";

// One row PER ATTEMPT, which is what makes a provider rotation legible: a
// failover reads as two rows with attempt 1 and 2 and different providers.
//
// This one table does three jobs, which is why there is no second one:
//   record  provider/latency/outcome — the point of the harness
//   cache   the newest ok row for (user, generator, input_hash) inside a TTL
//   quota   count(*) today where cached = false — durable, unlike the
//           in-memory login limiter, so a cold start can't reset it
export const aiRuns = pgTable(
  "ai_runs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    generator: varchar("generator", { length: 40 }).notNull(),
    // 'none' when the outcome was decided before a provider was reached.
    provider: varchar("provider", { length: 20 }).notNull(),
    model: varchar("model", { length: 60 }).notNull(),
    outcome: varchar("outcome", { length: 12 }).$type<AiOutcome>().notNull(),
    latencyMs: integer("latency_ms").notNull(),
    attempt: integer("attempt").notNull().default(1),
    // Hash of generator + prompt version + input. The cache key.
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    cached: boolean("cached").notNull().default(false),
    // What was PROPOSED. Kept because the habits table only records what was
    // kept: without this, a suggestion removed on the review screen would
    // vanish and the rejection rate would be unmeasurable.
    output: jsonb("output"),
    // A short, scrubbed message. NEVER a key and never the prompt.
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_ai_runs_cache").on(t.userId, t.generator, t.inputHash),
    index("idx_ai_runs_user_created").on(t.userId, t.createdAt.desc()),
    check(
      "ai_runs_outcome",
      sql`${t.outcome} IN ('ok', 'unavailable', 'invalid', 'error')`
    ),
  ]
);

// "We'll regenerate this later." Written only when every provider failed —
// which takes all three being down at once, so reaching this is rare.
//
// Deliberately not a queue and not a cron: the retry happens on the next visit
// to the review screen. The point is that the app never freezes on somebody
// else's outage, not that it has elaborate machinery for it.
export const aiPendingRequests = pgTable(
  "ai_pending_requests",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    generator: varchar("generator", { length: 40 }).notNull(),
    input: jsonb("input").notNull(),
    // Set when a retry succeeds, OR when the user finished the job by hand —
    // re-generating over a set someone already accepted would be a second
    // surprise after they thought they were done.
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_ai_pending_open")
      .on(t.userId, t.generator)
      .where(sql`${t.resolvedAt} IS NULL`),
  ]
);

// ─── Tier 0b: login attempts ─────────────────────────────────────────────────

// Durable replacement for the in-memory limiter, which reset on every cold
// start and was keyed on IP alone.
//
// Deliberately NOT keyed on user_id: login is pre-auth, and the handle typed
// into the form is a *claim*, not an identity — the same reason src/db/users.ts
// cannot take a branded UserId.
//
// Two kinds of key, doing two different jobs:
//   'ip'      the one that actually blocks
//   'handle'  detection only, for an attack spread across many IPs. It must
//             never block on its own: a handle-keyed lock would hand anyone a
//             denial-of-service against a named user by spamming their name,
//             and in this app the name IS the login.
export type AttemptKeyKind = "ip" | "handle";

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: serial("id").primaryKey(),
    keyKind: varchar("key_kind", { length: 8 })
      .$type<AttemptKeyKind>()
      .notNull(),
    keyValue: varchar("key_value", { length: 120 }).notNull(),
    failures: integer("failures").notNull().default(0),
    windowStart: timestamp("window_start", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique().on(t.keyKind, t.keyValue),
    check("login_attempts_key_kind", sql`${t.keyKind} IN ('ip', 'handle')`),
  ]
);
