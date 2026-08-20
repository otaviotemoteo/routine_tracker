// Moves the metric spine and the template layer from `habits` onto a new
// `activities` table, and re-grains `daily_checks` from per-habit to
// per-activity — see docs/ARCHITECTURE.md.
//
//   bun run db:migrate:activities
//
// Same discipline as migrate-habits.ts and migrate-rich-configs.ts, the two
// other migrations in this project that touch live data: pg over plain TCP
// (http has no interactive transactions), one transaction, every statement
// guarded so a second run finds everything already done and changes nothing.
//
// The one thing this migration does NOT do is reassign any id or slug — every
// habit's name/slug/template_kind/config/metric fields carry forward
// unchanged onto its new activity row, so daily_checks.details references
// (plan_day_id, book_id, followed_block_ids, struggled_block_id,
// language_slug, practices[].slug) keep resolving without being touched at
// all. What this script verifies, right before tightening any constraint, is
// exactly that.
//
// TEST AGAINST A NEON BRANCH FIRST. This is the one migration in the
// project's history that both creates a new table and changes the grain of
// the table holding every day of real logged history. Run it against a
// branch, run the app against the branch, compare Today/week/month/export
// against production for the same dates, before ever pointing this at the
// real database.
//
// Old columns (habits' six moved ones, daily_checks.habit_id, the old
// per-habit unique constraint) are left in place, dead, for a rollback
// window — see migrate-activities-cleanup.ts, NOT to be run until the new
// grain has been exercised in production without incident.
import pg from "pg";

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

    // ── 1. The new table ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS activities (
        id             serial PRIMARY KEY,
        user_id        integer NOT NULL REFERENCES users(id),
        habit_id       integer NOT NULL REFERENCES habits(id),
        name           varchar(50) NOT NULL,
        slug           varchar(50) NOT NULL,
        metric_type    varchar(10) NOT NULL DEFAULT 'binary',
        unit           varchar(20),
        target         integer,
        minimal_action varchar(200),
        template_kind  varchar(30),
        config         jsonb,
        source         varchar(12) NOT NULL DEFAULT 'human',
        why            text,
        active_from    date,
        active_to      date,
        position       integer NOT NULL DEFAULT 0,
        created_at     timestamptz DEFAULT now()
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS activities_user_slug_unique
        ON activities (user_id, slug)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activities_user_position
        ON activities (user_id, position)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activities_habit
        ON activities (habit_id, position)
    `);
    // ADD CONSTRAINT has no IF NOT EXISTS; both statements are in the same
    // transaction, so the constraint is only absent for the instant between —
    // same idiom migrate-habits.ts uses for the check constraints it adds.
    for (const [name, expr] of [
      ["activities_metric_type", `metric_type IN ('binary', 'count', 'duration')`],
      ["activities_source", `source IN ('human', 'ai_suggested', 'ai_edited')`],
    ]) {
      await client.query(`ALTER TABLE activities DROP CONSTRAINT IF EXISTS ${name}`);
      await client.query(`ALTER TABLE activities ADD CONSTRAINT ${name} CHECK (${expr})`);
    }

    // ── 2. The new column on daily_checks, nullable for now ─────────────────
    await client.query(`
      ALTER TABLE daily_checks
        ADD COLUMN IF NOT EXISTS activity_id integer REFERENCES activities(id)
    `);

    // ── 3. One activity per existing habit, unconditionally ─────────────────
    // Every habit — proposed or tracked, active or archived — gets exactly
    // one activity, so the 1:1 invariant holds uniformly before any second
    // activity is ever created going forward. name/slug/template_kind/config
    // and the whole metric spine carry forward verbatim, with the exact same
    // id-preservation guarantee migrate-rich-configs.ts already established
    // for config's own contents — this step doesn't touch config at all, it
    // only relocates the column. `why` is left NULL: it's reserved for a
    // per-activity briefing, not a copy of the habit's own `why` — see
    // docs/ARCHITECTURE.md.
    const seeded = await client.query(`
      INSERT INTO activities
        (user_id, habit_id, name, slug, metric_type, unit, target,
         minimal_action, template_kind, config, source,
         active_from, active_to, position, created_at)
      SELECT h.user_id, h.id, h.name, h.slug, h.metric_type, h.unit, h.target,
             h.minimal_action, h.template_kind, h.config, h.source,
             h.active_from, h.active_to, 0, h.created_at
        FROM habits h
       WHERE NOT EXISTS (SELECT 1 FROM activities a WHERE a.habit_id = h.id)
    `);
    console.log(`Seeded ${seeded.rowCount} default activities, one per habit.`);

    // ── 4. Backfill daily_checks.activity_id ─────────────────────────────────
    // Safe because step 3 guarantees exactly one activity per habit at this
    // point in the script — no ambiguity about which activity a check moves
    // to.
    const backfilled = await client.query(`
      UPDATE daily_checks c
         SET activity_id = a.id
        FROM activities a
       WHERE c.activity_id IS NULL
         AND a.habit_id = c.habit_id
    `);
    console.log(`Backfilled ${backfilled.rowCount} daily checks.`);

    // ── 5. Verify, hard-abort on any failure ─────────────────────────────────
    // Coverage: every check must have found its new activity. A non-zero
    // count means some daily_checks.habit_id pointed at a habit this script
    // didn't seed an activity for — a real integrity bug, not something to
    // paper over.
    const uncovered = await client.query(
      `SELECT count(*)::int AS n FROM daily_checks WHERE activity_id IS NULL`
    );
    if (uncovered.rows[0].n > 0) {
      throw new Error(
        `${uncovered.rows[0].n} daily_checks still have no activity_id. ` +
          `Refusing to proceed.`
      );
    }

    // Entity references: the same check migrate-rich-configs.ts ran before
    // its own drops, run again here. Defense in depth — config was copied
    // byte-for-byte in step 3, nothing in this script transforms it — but
    // it's cheap and it's exactly the discipline this codebase already
    // trusts for this class of change. Resolves through the SPECIFIC
    // activity each check now points to, not "the account's activity of
    // this kind" — there is no more ambiguity to reintroduce here.
    const { rows: detailRows } = await client.query<{
      activity_id: number;
      template_kind: string | null;
      config: Record<string, unknown> | null;
      details: Record<string, unknown> | null;
    }>(`
      SELECT c.activity_id, a.template_kind, a.config, c.details
        FROM daily_checks c JOIN activities a ON a.id = c.activity_id
       WHERE c.details IS NOT NULL
         AND a.template_kind IN ('treino','leitura','rotina','duolingo','espiritualidade')
    `);
    const missing: string[] = [];
    for (const row of detailRows) {
      const d = row.details;
      if (!d) continue;
      const cfg = row.config ?? {};
      if (row.template_kind === "treino" && typeof d.plan_day_id === "number") {
        const days = (cfg.days as { id: number }[] | undefined) ?? [];
        if (!days.some((x) => x.id === d.plan_day_id)) {
          missing.push(`activity ${row.activity_id} plan_day_id ${d.plan_day_id}`);
        }
      }
      if (row.template_kind === "leitura" && typeof d.book_id === "number") {
        const books = (cfg.books as { id: number }[] | undefined) ?? [];
        if (!books.some((x) => x.id === d.book_id)) {
          missing.push(`activity ${row.activity_id} book_id ${d.book_id}`);
        }
      }
      if (row.template_kind === "rotina") {
        const blocks = (cfg.blocks as { id: number }[] | undefined) ?? [];
        const ids = Array.isArray(d.followed_block_ids)
          ? (d.followed_block_ids as number[])
          : [];
        for (const id of ids) {
          if (!blocks.some((x) => x.id === id)) {
            missing.push(`activity ${row.activity_id} followed_block_id ${id}`);
          }
        }
        if (
          typeof d.struggled_block_id === "number" &&
          !blocks.some((x) => x.id === d.struggled_block_id)
        ) {
          missing.push(
            `activity ${row.activity_id} struggled_block_id ${d.struggled_block_id}`
          );
        }
      }
      if (row.template_kind === "duolingo" && Array.isArray(d.sessions)) {
        const langs = (cfg.languages as { slug: string }[] | undefined) ?? [];
        for (const s of d.sessions as { language_slug?: unknown }[]) {
          const slug = s.language_slug;
          if (typeof slug === "string" && !langs.some((x) => x.slug === slug)) {
            missing.push(`activity ${row.activity_id} language_slug ${slug}`);
          }
        }
      }
      if (row.template_kind === "espiritualidade" && Array.isArray(d.practices)) {
        const pracs = (cfg.practices as { slug: string }[] | undefined) ?? [];
        for (const p of d.practices as { slug?: unknown }[]) {
          const slug = p.slug;
          if (typeof slug === "string" && !pracs.some((x) => x.slug === slug)) {
            missing.push(`activity ${row.activity_id} practice slug ${slug}`);
          }
        }
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `${missing.length} daily_checks reference(s) don't resolve against ` +
          `their activity's config. Refusing to tighten constraints. ` +
          `First few: ${missing.slice(0, 10).join("; ")}`
      );
    }
    console.log(
      `Verified: all daily_checks entity references resolve against their activity's config.`
    );

    // ── 6. Tighten activity_id, relax habit_id ───────────────────────────────
    // activity_id is fully backfilled and verified — every check has one.
    // habit_id's NOT NULL is relaxed, not dropped: no application code will
    // write it on a new check going forward, but every existing row keeps
    // its old value, untouched, for the rollback window. The old
    // (user_id, habit_id, checked_at) unique constraint is left in place
    // too — harmless once every new row's habit_id is NULL, since Postgres
    // treats NULLs as distinct in a unique index — and is dropped, by name
    // looked up rather than guessed, in migrate-activities-cleanup.ts
    // alongside the column itself.
    await client.query(`ALTER TABLE daily_checks ALTER COLUMN activity_id SET NOT NULL`);
    await client.query(`ALTER TABLE daily_checks ALTER COLUMN habit_id DROP NOT NULL`);

    // ── 7. The new constraint ─────────────────────────────────────────────────
    await client.query(
      `ALTER TABLE daily_checks DROP CONSTRAINT IF EXISTS daily_checks_user_id_activity_id_checked_at_unique`
    );
    await client.query(`
      ALTER TABLE daily_checks
        ADD CONSTRAINT daily_checks_user_id_activity_id_checked_at_unique
        UNIQUE (user_id, activity_id, checked_at)
    `);

    // ── Guard-count logging — visibility, not a gate ─────────────────────────
    const [{ rows: habitCount }, { rows: activityCount }, { rows: checkCount }] =
      await Promise.all([
        client.query(`SELECT count(*)::int AS n FROM habits`),
        client.query(`SELECT count(*)::int AS n FROM activities`),
        client.query(`SELECT count(*)::int AS n FROM daily_checks`),
      ]);
    console.log(`  habits: ${habitCount[0].n} row(s).`);
    console.log(`  activities: ${activityCount[0].n} row(s).`);
    console.log(`  daily_checks: ${checkCount[0].n} row(s), all with an activity_id.`);

    await client.query("COMMIT");
    console.log("Activities are real. daily_checks is grained by activity.");
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
