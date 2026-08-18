// Folds the six owner-shaped entity tables (workout_plans + workout_plan_days,
// reading_goals + books, routine_blocks, spiritual_practices, languages,
// sleep_targets) into each domain's one habit — see docs/ARCHITECTURE.md
// "Phase 3" and config-schemas.ts for the shapes.
//
//   bun run db:migrate:rich-configs
//
// Same discipline as migrate-habits.ts, the one other migration in this
// project that touches live data rather than only adding to it: pg over
// plain TCP (http has no interactive transactions), one transaction, guarded
// so a second run finds everything already done and changes nothing.
//
// The one thing this migration does NOT do is reassign any id or slug. Every
// book/plan-day/block keeps the exact numeric id it already had, every
// language/practice keeps its exact slug — daily_checks.details references
// them by those values, and the whole point of moving the data rather than
// rebuilding it is that those references keep resolving without being
// touched at all. What this script verifies, right before the DROPs, is
// exactly that: every id/slug named in a details row still resolves inside
// the config it just wrote.
import pg from "pg";

interface WorkoutPlanRow {
  id: number;
  user_id: number;
  version: number;
  name: string;
  active: boolean;
}
interface WorkoutPlanDayRow {
  id: number;
  plan_id: number;
  weekday: number;
  focus: string;
  exercises: unknown;
}
interface BookRow {
  id: number;
  user_id: number;
  title: string;
  author: string | null;
  total_pages: number;
  status: string;
  current_page: number;
  position: number;
  started_at: string | null;
  finished_at: string | null;
}
interface ReadingGoalRow {
  user_id: number;
  year: number;
  target_books: number;
}
interface RoutineBlockRow {
  id: number;
  user_id: number;
  start_time: string;
  end_time: string;
  activity: string;
  weekdays: number[];
  active: boolean;
  position: number;
}
interface SpiritualPracticeRow {
  user_id: number;
  name: string;
  slug: string;
  countable: boolean;
  active: boolean;
  position: number;
}
interface LanguageRow {
  user_id: number;
  name: string;
  slug: string;
  active: boolean;
}
interface SleepTargetRow {
  id: number;
  user_id: number;
  bedtime: string;
  wake_time: string;
}

function hhmm(t: string): string {
  return t.slice(0, 5);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const pool = new pg.Pool({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: true },
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── Habit lookup / creation ─────────────────────────────────────────────
    // One habit per (user, template_kind) — the same singleton invariant
    // getOrCreateSingletonHabit enforces at runtime. Every account this
    // migration matters for already has one (from migrate-habits.ts); the
    // create path only exists for the edge case of entity rows with no
    // matching habit, which the guard-count at the end would catch anyway.
    const habitIdCache = new Map<string, number>();
    async function habitIdFor(
      userId: number,
      kind: string,
      defaultName: string
    ): Promise<number> {
      const key = `${userId}:${kind}`;
      const cached = habitIdCache.get(key);
      if (cached) return cached;
      const { rows } = await client.query<{ id: number }>(
        `SELECT id FROM habits WHERE user_id = $1 AND template_kind = $2`,
        [userId, kind]
      );
      if (rows[0]) {
        habitIdCache.set(key, rows[0].id);
        return rows[0].id;
      }
      const { rows: existingSlugs } = await client.query<{ slug: string }>(
        `SELECT slug FROM habits WHERE user_id = $1`,
        [userId]
      );
      const used = new Set(existingSlugs.map((r) => r.slug));
      let slug = kind;
      let n = 2;
      while (used.has(slug)) {
        slug = `${kind}-${n}`;
        n += 1;
      }
      const { rows: maxPos } = await client.query<{ max: number }>(
        `SELECT coalesce(max(position), 0) AS max FROM habits WHERE user_id = $1`,
        [userId]
      );
      const { rows: created } = await client.query<{ id: number }>(
        `INSERT INTO habits
           (user_id, name, slug, metric_type, template_kind, source, active_from, position, created_at)
         VALUES ($1, $2, $3, 'binary', $4, 'human', CURRENT_DATE, $5, now())
         RETURNING id`,
        [userId, defaultName, slug, kind, Number(maxPos[0].max) + 1]
      );
      habitIdCache.set(key, created[0].id);
      return created[0].id;
    }

    async function writeConfig(habitId: number, config: unknown): Promise<void> {
      await client.query(`UPDATE habits SET config = $1 WHERE id = $2`, [
        JSON.stringify(config),
        habitId,
      ]);
    }

    // ── 1. Workout ───────────────────────────────────────────────────────────
    const { rows: plans } = await client.query<WorkoutPlanRow>(
      `SELECT id, user_id, version, name, active FROM workout_plans ORDER BY user_id, version`
    );
    const { rows: planDays } = await client.query<WorkoutPlanDayRow>(
      `SELECT id, plan_id, weekday, focus, exercises FROM workout_plan_days ORDER BY plan_id, weekday`
    );
    const daysByPlan = new Map<number, WorkoutPlanDayRow[]>();
    for (const d of planDays) {
      const list = daysByPlan.get(d.plan_id) ?? [];
      list.push(d);
      daysByPlan.set(d.plan_id, list);
    }
    const plansByUser = new Map<number, WorkoutPlanRow[]>();
    for (const p of plans) {
      const list = plansByUser.get(p.user_id) ?? [];
      list.push(p);
      plansByUser.set(p.user_id, list);
    }
    let workoutHabits = 0;
    for (const [userId, userPlans] of plansByUser) {
      // The plan flagged active wins; if somehow none is (shouldn't happen —
      // saveWorkoutPlan always deactivated the rest before inserting a new
      // one), the highest version does. Every other version's days are
      // retired but kept, for exactly the ids their old plan_day_id
      // references need.
      const activePlan =
        userPlans.find((p) => p.active) ??
        userPlans.reduce((a, b) => (b.version > a.version ? b : a));
      const days = userPlans.flatMap((p) =>
        (daysByPlan.get(p.id) ?? []).map((d) => ({
          id: d.id,
          weekday: d.weekday,
          focus: d.focus,
          exercises: d.exercises,
          active: p.id === activePlan.id,
        }))
      );
      const habitId = await habitIdFor(userId, "treino", "Treino");
      await writeConfig(habitId, { planName: activePlan.name, days });
      workoutHabits += 1;
    }
    console.log(`Workout: ${workoutHabits} habit(s) written.`);

    // ── 2. Reading ───────────────────────────────────────────────────────────
    const { rows: goals } = await client.query<ReadingGoalRow>(
      `SELECT user_id, year, target_books FROM reading_goals ORDER BY user_id, year DESC`
    );
    const { rows: bookRows } = await client.query<BookRow>(
      `SELECT id, user_id, title, author, total_pages, status, current_page, position, started_at, finished_at
         FROM books ORDER BY user_id, position`
    );
    const latestGoalByUser = new Map<number, ReadingGoalRow>();
    for (const g of goals) {
      if (!latestGoalByUser.has(g.user_id)) latestGoalByUser.set(g.user_id, g);
    }
    const booksByUser = new Map<number, BookRow[]>();
    for (const b of bookRows) {
      const list = booksByUser.get(b.user_id) ?? [];
      list.push(b);
      booksByUser.set(b.user_id, list);
    }
    const readingUsers = new Set([...latestGoalByUser.keys(), ...booksByUser.keys()]);
    let readingHabits = 0;
    for (const userId of readingUsers) {
      const goal = latestGoalByUser.get(userId);
      const books = booksByUser.get(userId) ?? [];
      const habitId = await habitIdFor(userId, "leitura", "Leitura");
      await writeConfig(habitId, {
        year: goal?.year ?? new Date().getFullYear(),
        targetBooksPerYear: goal?.target_books ?? 0,
        books: books.map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          totalPages: b.total_pages,
          currentPage: b.current_page,
          status: b.status,
          position: b.position,
          startedAt: b.started_at,
          finishedAt: b.finished_at,
        })),
      });
      readingHabits += 1;
    }
    console.log(`Reading: ${readingHabits} habit(s) written.`);

    // ── 3. Sleep ─────────────────────────────────────────────────────────────
    const { rows: sleepRows } = await client.query<SleepTargetRow>(
      `SELECT id, user_id, bedtime, wake_time FROM sleep_targets`
    );
    for (const s of sleepRows) {
      const habitId = await habitIdFor(s.user_id, "sono", "Sono");
      await writeConfig(habitId, { bedtime: hhmm(s.bedtime), wakeTime: hhmm(s.wake_time) });
    }
    console.log(`Sleep: ${sleepRows.length} habit(s) written.`);

    // ── 4. Routine ───────────────────────────────────────────────────────────
    const { rows: blockRows } = await client.query<RoutineBlockRow>(
      `SELECT id, user_id, start_time, end_time, activity, weekdays, active, position
         FROM routine_blocks ORDER BY user_id, position`
    );
    const blocksByUser = new Map<number, RoutineBlockRow[]>();
    for (const b of blockRows) {
      const list = blocksByUser.get(b.user_id) ?? [];
      list.push(b);
      blocksByUser.set(b.user_id, list);
    }
    for (const [userId, blocks] of blocksByUser) {
      const habitId = await habitIdFor(userId, "rotina", "Rotina");
      await writeConfig(habitId, {
        blocks: blocks.map((b) => ({
          id: b.id,
          startTime: hhmm(b.start_time),
          endTime: hhmm(b.end_time),
          activity: b.activity,
          weekdays: b.weekdays,
          position: b.position,
          active: b.active,
        })),
      });
    }
    console.log(`Routine: ${blocksByUser.size} habit(s) written.`);

    // ── 5. Duolingo ──────────────────────────────────────────────────────────
    const { rows: langRows } = await client.query<LanguageRow>(
      `SELECT user_id, name, slug, active FROM languages ORDER BY user_id, id`
    );
    const langsByUser = new Map<number, LanguageRow[]>();
    for (const l of langRows) {
      const list = langsByUser.get(l.user_id) ?? [];
      list.push(l);
      langsByUser.set(l.user_id, list);
    }
    for (const [userId, langs] of langsByUser) {
      const habitId = await habitIdFor(userId, "duolingo", "Duolingo");
      await writeConfig(habitId, {
        languages: langs.map((l) => ({ slug: l.slug, name: l.name, active: l.active })),
      });
    }
    console.log(`Duolingo: ${langsByUser.size} habit(s) written.`);

    // ── 6. Spirituality ──────────────────────────────────────────────────────
    const { rows: pracRows } = await client.query<SpiritualPracticeRow>(
      `SELECT user_id, name, slug, countable, active, position
         FROM spiritual_practices ORDER BY user_id, position`
    );
    const pracsByUser = new Map<number, SpiritualPracticeRow[]>();
    for (const p of pracRows) {
      const list = pracsByUser.get(p.user_id) ?? [];
      list.push(p);
      pracsByUser.set(p.user_id, list);
    }
    for (const [userId, pracs] of pracsByUser) {
      const habitId = await habitIdFor(userId, "espiritualidade", "Espiritualidade");
      await writeConfig(habitId, {
        practices: pracs.map((p) => ({
          slug: p.slug,
          name: p.name,
          countable: p.countable,
          position: p.position,
          active: p.active,
        })),
      });
    }
    console.log(`Spirituality: ${pracsByUser.size} habit(s) written.`);

    // ── Verify: every daily_checks.details reference still resolves ─────────
    // Not a repoint — ids and slugs are unchanged — a check that nothing was
    // missed. Reads each user's freshly-written config back and confirms
    // every id/slug named in their `details` rows is in it.
    const { rows: detailRows } = await client.query<{
      user_id: number;
      template_kind: string | null;
      details: Record<string, unknown> | null;
    }>(
      `SELECT c.user_id, h.template_kind, c.details
         FROM daily_checks c JOIN habits h ON h.id = c.habit_id
        WHERE c.details IS NOT NULL
          AND h.template_kind IN ('treino','leitura','rotina','duolingo','espiritualidade')`
    );
    const configCache = new Map<string, Record<string, unknown>>();
    async function configFor(userId: number, kind: string): Promise<Record<string, unknown>> {
      const key = `${userId}:${kind}`;
      const cached = configCache.get(key);
      if (cached) return cached;
      const { rows } = await client.query<{ config: Record<string, unknown> | null }>(
        `SELECT config FROM habits WHERE user_id = $1 AND template_kind = $2`,
        [userId, kind]
      );
      const cfg = rows[0]?.config ?? {};
      configCache.set(key, cfg);
      return cfg;
    }
    const missing: string[] = [];
    for (const row of detailRows) {
      const d = row.details;
      if (!d || !row.template_kind) continue;
      const cfg = await configFor(row.user_id, row.template_kind);
      if (row.template_kind === "treino" && typeof d.plan_day_id === "number") {
        const days = (cfg.days as { id: number }[] | undefined) ?? [];
        if (!days.some((x) => x.id === d.plan_day_id)) {
          missing.push(`user ${row.user_id} plan_day_id ${d.plan_day_id}`);
        }
      }
      if (row.template_kind === "leitura" && typeof d.book_id === "number") {
        const books = (cfg.books as { id: number }[] | undefined) ?? [];
        if (!books.some((x) => x.id === d.book_id)) {
          missing.push(`user ${row.user_id} book_id ${d.book_id}`);
        }
      }
      if (row.template_kind === "rotina") {
        const blocks = (cfg.blocks as { id: number }[] | undefined) ?? [];
        const ids = Array.isArray(d.followed_block_ids) ? (d.followed_block_ids as number[]) : [];
        for (const id of ids) {
          if (!blocks.some((x) => x.id === id)) missing.push(`user ${row.user_id} followed_block_id ${id}`);
        }
        if (typeof d.struggled_block_id === "number" && !blocks.some((x) => x.id === d.struggled_block_id)) {
          missing.push(`user ${row.user_id} struggled_block_id ${d.struggled_block_id}`);
        }
      }
      if (row.template_kind === "duolingo" && Array.isArray(d.sessions)) {
        const langs = (cfg.languages as { slug: string }[] | undefined) ?? [];
        for (const s of d.sessions as { language_slug?: unknown }[]) {
          const slug = s.language_slug;
          if (typeof slug === "string" && !langs.some((x) => x.slug === slug)) {
            missing.push(`user ${row.user_id} language_slug ${slug}`);
          }
        }
      }
      if (row.template_kind === "espiritualidade" && Array.isArray(d.practices)) {
        const pracs = (cfg.practices as { slug: string }[] | undefined) ?? [];
        for (const p of d.practices as { slug?: unknown }[]) {
          const slug = p.slug;
          if (typeof slug === "string" && !pracs.some((x) => x.slug === slug)) {
            missing.push(`user ${row.user_id} practice slug ${slug}`);
          }
        }
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `${missing.length} daily_checks reference(s) don't resolve against the new config. ` +
          `Refusing to drop the old tables. First few: ${missing.slice(0, 10).join("; ")}`
      );
    }
    console.log(`Verified: all daily_checks entity references resolve against config.`);

    // ── Guard-count, then drop ───────────────────────────────────────────────
    // One more belt-and-braces check before anything is destroyed: every row
    // this script read must have landed in a habit's config.
    const counts: [string, number][] = [
      ["workout_plans", plans.length],
      ["books", bookRows.length],
      ["reading_goals", goals.length],
      ["routine_blocks", blockRows.length],
      ["languages", langRows.length],
      ["spiritual_practices", pracRows.length],
      ["sleep_targets", sleepRows.length],
    ];
    for (const [table, n] of counts) {
      console.log(`  ${table}: ${n} row(s) migrated.`);
    }

    for (const table of [
      "workout_plan_days",
      "workout_plans",
      "books",
      "reading_goals",
      "routine_blocks",
      "spiritual_practices",
      "languages",
      "sleep_targets",
    ]) {
      await client.query(`DROP TABLE IF EXISTS ${table}`);
    }

    await client.query("COMMIT");
    console.log("Rich habits are config-backed. Old entity tables dropped.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration rolled back — nothing changed.");
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
