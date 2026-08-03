// One-shot migration from the single-user app to accounts.
//
//   bun run db:migrate
//
// Atomic: creates `users`, gives every per-user table a `user_id`, inserts the
// owner's account from APP_PASSWORD, assigns every existing row to it, then
// makes the columns NOT NULL. Either all of it lands or none of it does, and
// running it twice is a no-op.
//
// Accounts are only ever created here and by `user:create` — never by the UI
// or the API.
// node-postgres over a plain TCP connection, not the app's neon-http driver:
// http has no interactive transactions, and a half-applied migration is
// exactly what this must never leave behind. Neon accepts ordinary Postgres
// connections, so the same script runs against Neon and against local docker —
// which is what makes it testable before it touches anything real.
import pg from "pg";
import { hashPassword, toHandle } from "@/lib/password";

const OWNER = process.env.MIGRATE_OWNER_NAME ?? "otavio";

// The tables that become per-user. workout_plan_days is absent on purpose: it
// reaches its owner through plan_id.
const SCOPED_TABLES = [
  "daily_checks",
  "workout_plans",
  "reading_goals",
  "books",
  "routine_blocks",
  "spiritual_practices",
  "languages",
  "sleep_targets",
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  const password = process.env.APP_PASSWORD;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  if (!password) {
    console.error(
      "APP_PASSWORD is not set — it becomes the owner's password. Keep it set\n" +
        "until after this runs; you can change the password in the UI afterwards."
    );
    process.exit(1);
  }
  const pool = new pg.Pool({
    connectionString: url,
    // Neon requires TLS; a local docker Postgres doesn't offer it.
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: true },
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id serial PRIMARY KEY,
        name varchar(40) NOT NULL,
        handle varchar(40) NOT NULL UNIQUE,
        password_hash text,
        created_at timestamptz DEFAULT now()
      )`);

    for (const table of SCOPED_TABLES) {
      await client.query(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id)`
      );
    }

    // The owner: created once, with the password already in use, so the
    // account holding every existing row is never claimable by a stranger.
    const handle = toHandle(OWNER);
    const existing = await client.query<{ id: number }>(
      "SELECT id FROM users WHERE handle = $1",
      [handle]
    );
    let ownerId: number;
    if (existing.rowCount && existing.rows[0]) {
      ownerId = existing.rows[0].id;
      console.log(`Owner "${OWNER}" already exists (id ${ownerId}).`);
    } else {
      const inserted = await client.query<{ id: number }>(
        "INSERT INTO users (name, handle, password_hash) VALUES ($1, $2, $3) RETURNING id",
        [OWNER, handle, await hashPassword(password)]
      );
      ownerId = inserted.rows[0].id;
      console.log(`Created owner "${OWNER}" (id ${ownerId}).`);
    }

    let claimed = 0;
    for (const table of SCOPED_TABLES) {
      const res = await client.query(
        `UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`,
        [ownerId]
      );
      claimed += res.rowCount ?? 0;
    }
    console.log(`Assigned ${claimed} existing rows to the owner.`);

    for (const table of SCOPED_TABLES) {
      await client.query(`ALTER TABLE ${table} ALTER COLUMN user_id SET NOT NULL`);
    }

    // Uniqueness that used to be global is now per-account.
    await client.query(`
      ALTER TABLE daily_checks DROP CONSTRAINT IF EXISTS daily_checks_habit_id_checked_at_unique;
      ALTER TABLE reading_goals DROP CONSTRAINT IF EXISTS reading_goals_year_unique;
      ALTER TABLE spiritual_practices DROP CONSTRAINT IF EXISTS spiritual_practices_slug_unique;
      ALTER TABLE languages DROP CONSTRAINT IF EXISTS languages_slug_unique;
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS daily_checks_user_habit_date_unique
        ON daily_checks (user_id, habit_id, checked_at);
      CREATE UNIQUE INDEX IF NOT EXISTS reading_goals_user_year_unique
        ON reading_goals (user_id, year);
      CREATE UNIQUE INDEX IF NOT EXISTS spiritual_practices_user_slug_unique
        ON spiritual_practices (user_id, slug);
      CREATE UNIQUE INDEX IF NOT EXISTS languages_user_slug_unique
        ON languages (user_id, slug);
      CREATE INDEX IF NOT EXISTS idx_checks_user_date
        ON daily_checks (user_id, checked_at DESC);
    `);

    await client.query("COMMIT");
    console.log("Migration complete. You can remove APP_PASSWORD once you have");
    console.log("changed your password from the app.");
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
