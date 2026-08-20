// Drops what migrate-activities.ts deliberately left behind: daily_checks'
// old habit_id column and its now-pointless unique constraint, and the six
// dead columns migrate-activities.ts left on `habits`.
//
//   bun run db:migrate:activities:cleanup
//
// DO NOT RUN THIS until the new grain (activities, daily_checks.activity_id)
// has been exercised in production for a few days without incident — that
// window is the entire reason migrate-activities.ts left these in place
// instead of dropping them in the same transaction. See
// docs/ARCHITECTURE.md and migrate-activities.ts's own header.
//
// Same discipline as every other migration here: pg over plain TCP, one
// transaction, guarded so a second run finds everything already gone and
// changes nothing.
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

    // ── Guard: refuse if anything still looks unmigrated ────────────────────
    // A NULL activity_id would mean migrate-activities.ts either never ran
    // or didn't finish — either way, dropping habit_id now would destroy the
    // only remaining link from a check to its habit.
    const uncovered = await client.query(
      `SELECT count(*)::int AS n FROM daily_checks WHERE activity_id IS NULL`
    );
    if (uncovered.rows[0].n > 0) {
      throw new Error(
        `${uncovered.rows[0].n} daily_checks still have no activity_id. ` +
          `migrate-activities.ts hasn't fully run — refusing to clean up.`
      );
    }

    // ── Drop the old unique constraint, found by its columns, not a guessed
    //    name ───────────────────────────────────────────────────────────────
    // migrate-habits.ts and migrate-rich-configs.ts both learned this the
    // hard way: whatever name drizzle-kit or an earlier hand-written
    // migration actually gave a constraint doesn't have to match this
    // project's usual naming convention. Order-independent set comparison —
    // conkey's column order need not match the order named here.
    const { rows: oldUnique } = await client.query<{ conname: string }>(`
      SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
       WHERE rel.relname = 'daily_checks'
         AND con.contype = 'u'
         AND (
           SELECT array_agg(attnum ORDER BY attnum) FROM unnest(con.conkey) AS attnum
         ) = (
           SELECT array_agg(attnum ORDER BY attnum)
             FROM pg_attribute
            WHERE attrelid = rel.oid
              AND attname IN ('user_id', 'habit_id', 'checked_at')
         )
    `);
    for (const row of oldUnique) {
      await client.query(`ALTER TABLE daily_checks DROP CONSTRAINT ${row.conname}`);
      console.log(`Dropped old unique constraint ${row.conname}.`);
    }

    // ── Drop the dead columns ─────────────────────────────────────────────────
    await client.query(`ALTER TABLE daily_checks DROP COLUMN IF EXISTS habit_id`);
    await client.query(`
      ALTER TABLE habits
        DROP COLUMN IF EXISTS metric_type,
        DROP COLUMN IF EXISTS unit,
        DROP COLUMN IF EXISTS target,
        DROP COLUMN IF EXISTS minimal_action,
        DROP COLUMN IF EXISTS template_kind,
        DROP COLUMN IF EXISTS config
    `);

    await client.query("COMMIT");
    console.log("Dead columns dropped. habits and daily_checks match the activity model exactly.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Cleanup rolled back — nothing changed.");
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
