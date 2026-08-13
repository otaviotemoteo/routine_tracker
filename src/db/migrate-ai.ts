// Creates the AI harness tables and the durable login limiter.
//
//   bun run db:migrate:ai
//
// Purely additive — it touches nothing that already holds data, unlike
// migrate-habits.ts. Same shape as migrate-assessment.ts: one transaction over
// a plain pg connection, every statement guarded, safe to re-run.
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

    // One row per ATTEMPT, not per call: that is what makes a provider
    // rotation legible afterwards as two rows with different providers.
    //
    // `output` holds what was PROPOSED. It has to live here because the habits
    // table only records what was kept — without this column, a suggestion the
    // user removed on the review screen would leave no trace and the rejection
    // rate would be unmeasurable.
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_runs (
        id          serial PRIMARY KEY,
        user_id     integer NOT NULL REFERENCES users(id),
        generator   varchar(40) NOT NULL,
        provider    varchar(20) NOT NULL,
        model       varchar(60) NOT NULL,
        outcome     varchar(12) NOT NULL,
        latency_ms  integer NOT NULL,
        attempt     integer NOT NULL DEFAULT 1,
        input_hash  varchar(64) NOT NULL,
        cached      boolean NOT NULL DEFAULT false,
        output      jsonb,
        error       text,
        created_at  timestamptz DEFAULT now()
      )`);

    await client.query(`
      ALTER TABLE ai_runs DROP CONSTRAINT IF EXISTS ai_runs_outcome`);
    await client.query(`
      ALTER TABLE ai_runs ADD CONSTRAINT ai_runs_outcome
        CHECK (outcome IN ('ok', 'unavailable', 'invalid', 'error'))`);

    // The cache lookup and the daily quota count are the two hot reads.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_runs_cache
        ON ai_runs (user_id, generator, input_hash);
      CREATE INDEX IF NOT EXISTS idx_ai_runs_user_created
        ON ai_runs (user_id, created_at DESC);
    `);

    // Reaching this table takes all three providers failing at once.
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_pending_requests (
        id          serial PRIMARY KEY,
        user_id     integer NOT NULL REFERENCES users(id),
        generator   varchar(40) NOT NULL,
        input       jsonb NOT NULL,
        resolved_at timestamptz,
        created_at  timestamptz DEFAULT now()
      )`);

    // Partial index: the only question ever asked of this table is "does this
    // user have an unresolved request?", and resolved rows are kept purely as
    // history.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_pending_open
        ON ai_pending_requests (user_id, generator)
        WHERE resolved_at IS NULL
    `);

    // The durable login limiter, replacing the in-memory Map that reset on
    // every cold start. Not keyed on user_id: login is pre-auth, and the
    // handle someone types is a claim rather than an identity.
    await client.query(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id           serial PRIMARY KEY,
        key_kind     varchar(8) NOT NULL,
        key_value    varchar(120) NOT NULL,
        failures     integer NOT NULL DEFAULT 0,
        window_start timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz DEFAULT now()
      )`);

    await client.query(`
      ALTER TABLE login_attempts DROP CONSTRAINT IF EXISTS login_attempts_key_kind`);
    await client.query(`
      ALTER TABLE login_attempts ADD CONSTRAINT login_attempts_key_kind
        CHECK (key_kind IN ('ip', 'handle'))`);

    // The upsert that records a failure leans on this.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS login_attempts_key_unique
        ON login_attempts (key_kind, key_value)
    `);

    await client.query("COMMIT");
    console.log("AI harness and login limiter ready.");
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
