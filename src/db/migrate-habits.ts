// Turns `habits` from a shared catalogue of seven rows into a per-user table.
//
//   bun run db:migrate:habits
//
// This is the one migration in the project that touches live data rather than
// only adding to it: it clones the seven catalogue rows per account and then
// repoints every existing daily_check at its owner's copy. Otávio's real
// history goes through this, so the whole thing is one transaction over a
// plain pg connection — http has no interactive transactions, and a
// half-applied version of THIS script is the outcome that must never happen.
//
// Re-runnable: every statement is guarded, and the clone step keys on
// (user_id, slug), so a second run finds everything already done and changes
// nothing. Running it twice is the cheapest way to prove that.
import pg from "pg";

// Sensible metric for each of the seven, so the migrated rows aren't all
// pretending to be binary. It changes nothing about how they render — they
// keep their own templates — but it makes the column honest from day one.
const LEGACY_METRICS: Record<string, { metric: string; unit: string | null }> = {
  treino: { metric: "binary", unit: null },
  leitura: { metric: "count", unit: "pages" },
  sono: { metric: "duration", unit: "hours" },
  rotina: { metric: "count", unit: "blocks" },
  duolingo: { metric: "count", unit: "lessons" },
  espiritualidade: { metric: "count", unit: "practices" },
  hobby: { metric: "duration", unit: "minutes" },
};

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

    // ── 1. The new columns ──────────────────────────────────────────────────
    // user_id arrives nullable: the seven catalogue rows have no owner yet and
    // step 5 is what makes the column NOT NULL, once every row has one.
    await client.query(`
      ALTER TABLE habits
        ADD COLUMN IF NOT EXISTS user_id        integer REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS domain_id      integer REFERENCES life_domains(id),
        ADD COLUMN IF NOT EXISTS goal_id        integer,
        ADD COLUMN IF NOT EXISTS metric_type    varchar(10) NOT NULL DEFAULT 'binary',
        ADD COLUMN IF NOT EXISTS unit           varchar(20),
        ADD COLUMN IF NOT EXISTS target         integer,
        ADD COLUMN IF NOT EXISTS minimal_action varchar(200),
        ADD COLUMN IF NOT EXISTS template_kind  varchar(30),
        ADD COLUMN IF NOT EXISTS config         jsonb,
        ADD COLUMN IF NOT EXISTS source         varchar(12) NOT NULL DEFAULT 'human',
        ADD COLUMN IF NOT EXISTS why            text,
        ADD COLUMN IF NOT EXISTS active_from    date,
        ADD COLUMN IF NOT EXISTS active_to      date,
        ADD COLUMN IF NOT EXISTS position       integer NOT NULL DEFAULT 0
    `);

    // The per-account uniqueness has to exist before the clone step, since the
    // clone leans on it for idempotency.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS habits_user_slug_unique
        ON habits (user_id, slug)
    `);

    // ── 2. Clone the catalogue, once per account ────────────────────────────
    // template_kind = the old slug, so each clone keeps rendering through the
    // renderer it always used. position comes from the catalogue order rather
    // than defaulting to 0 for all seven — a tie would leave Today's ordering
    // to whatever the planner felt like returning that day.
    const cloned = await client.query(`
      INSERT INTO habits
        (user_id, name, slug, icon, optional, metric_type, unit,
         template_kind, source, position, created_at)
      SELECT u.id, h.name, h.slug, h.icon, h.optional,
             COALESCE(m.metric, 'binary'), m.unit,
             h.slug, 'human',
             row_number() OVER (PARTITION BY u.id ORDER BY h.id),
             h.created_at
        FROM users u
        CROSS JOIN habits h
        LEFT JOIN (VALUES
          ${Object.entries(LEGACY_METRICS)
            .map(([slug, m]) => `('${slug}', '${m.metric}', ${m.unit ? `'${m.unit}'` : "NULL"})`)
            .join(",\n          ")}
        ) AS m(slug, metric, unit) ON m.slug = h.slug
       WHERE h.user_id IS NULL
      ON CONFLICT (user_id, slug) DO NOTHING
    `);
    console.log(`Cloned ${cloned.rowCount} habit rows to their owners.`);

    // ── 3. Repoint the history ──────────────────────────────────────────────
    // Every existing check points at a shared row; move it to the copy that
    // belongs to the account that made the check. Matched on slug, which is
    // what the clone preserved.
    const moved = await client.query(`
      UPDATE daily_checks c
         SET habit_id = mine.id
        FROM habits shared, habits mine
       WHERE c.habit_id  = shared.id
         AND shared.user_id IS NULL
         AND mine.user_id = c.user_id
         AND mine.slug    = shared.slug
    `);
    console.log(`Repointed ${moved.rowCount} daily checks.`);

    // ── 4. Backfill active_from ─────────────────────────────────────────────
    // A migrated habit has been tracked since the day it was first logged, not
    // since today. Getting this wrong would move every adherence denominator,
    // because countTrackedDays() reads from the first record onward.
    //
    // NULL means "proposed" everywhere else in the app, so leaving a migrated
    // row null would hide it from Today entirely — hence COALESCE to today for
    // a habit that somehow has no checks at all.
    await client.query(`
      UPDATE habits h
         SET active_from = COALESCE(
               (SELECT min(c.checked_at) FROM daily_checks c
                 WHERE c.habit_id = h.id),
               CURRENT_DATE)
       WHERE h.user_id IS NOT NULL
         AND h.active_from IS NULL
    `);

    // ── 5. Retire the shared rows ───────────────────────────────────────────
    // Nothing references them now. Guarded rather than assumed: if any check
    // still points at one, the DELETE fails the FK and the whole transaction
    // rolls back, which is the correct outcome.
    const orphaned = await client.query(`
      SELECT count(*)::int AS n FROM daily_checks c
        JOIN habits h ON h.id = c.habit_id
       WHERE h.user_id IS NULL
    `);
    if (orphaned.rows[0].n > 0) {
      throw new Error(
        `${orphaned.rows[0].n} daily_checks still point at a shared habit. ` +
          `Refusing to delete the catalogue.`
      );
    }
    const removed = await client.query(`DELETE FROM habits WHERE user_id IS NULL`);
    if (removed.rowCount) console.log(`Removed ${removed.rowCount} shared rows.`);

    // Now that every row has an owner. Skipped when there are no rows at all
    // (a fresh database), where the ALTER is still correct but says nothing.
    await client.query(`ALTER TABLE habits ALTER COLUMN user_id SET NOT NULL`);

    // active_from stays NULLABLE on purpose: null is how a proposed habit —
    // one a generator wrote but the user has not accepted — stays invisible.

    // ── 6. Constraints ──────────────────────────────────────────────────────
    // The old global slug uniqueness is exactly what stopped two people from
    // both tracking "leitura".
    await client.query(`ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_slug_unique`);
    await client.query(`ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_slug_key`);

    // ADD CONSTRAINT has no IF NOT EXISTS; both statements are in the same
    // transaction, so the constraint is only absent for the instant between.
    for (const [name, expr] of [
      ["habits_metric_type", `metric_type IN ('binary', 'count', 'duration')`],
      ["habits_source", `source IN ('human', 'ai_suggested', 'ai_edited')`],
    ]) {
      await client.query(`ALTER TABLE habits DROP CONSTRAINT IF EXISTS ${name}`);
      await client.query(`ALTER TABLE habits ADD CONSTRAINT ${name} CHECK (${expr})`);
    }

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_habits_user_position
        ON habits (user_id, position)
    `);

    // ── 7. Churn auditing (Part 2) — one nullable column, nothing more ──────
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS first_run_step varchar(30)
    `);

    await client.query("COMMIT");
    console.log("Habits are per-user.");
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
