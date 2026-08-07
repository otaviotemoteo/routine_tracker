// Creates the values layer: life domains, cycles, assessments, ratings and
// direction narratives.
//
//   bun run db:migrate:assessment
//
// Additive — it touches nothing the tracker already uses. Atomic and
// re-runnable: every statement is guarded, so running it twice is a no-op and
// a failure halfway through leaves the database exactly as it was.
//
// node-postgres over a plain TCP connection, not the app's neon-http driver:
// http has no interactive transactions, and a half-applied migration is
// exactly what this must never leave behind. Neon accepts ordinary Postgres
// connections, so the same script runs against Neon and against local docker.
import pg from "pg";
import { DOMAIN_SLUGS } from "@/lib/domains";

// The six rating columns and their shared 1–10 bound. One check per column
// rather than one combined check, so a violation names the column that broke.
const RATING_COLUMNS = [
  "possibility",
  "importance_now",
  "importance_general",
  "action",
  "action_satisfaction",
  "concern",
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
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
      CREATE TABLE IF NOT EXISTS life_domains (
        id serial PRIMARY KEY,
        slug varchar(40) NOT NULL UNIQUE,
        position integer NOT NULL
      )`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS cycles (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        label varchar(20) NOT NULL,
        starts_at date NOT NULL,
        ends_at date NOT NULL,
        status varchar(10) NOT NULL DEFAULT 'active',
        closed_at timestamptz,
        created_at timestamptz DEFAULT now()
      )`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS assessments (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        cycle_id integer NOT NULL REFERENCES cycles(id),
        taken_at date NOT NULL,
        kind varchar(10) NOT NULL DEFAULT 'full',
        context_note text,
        priority_domains varchar(40)[] NOT NULL DEFAULT '{}',
        completed_at timestamptz,
        voided_at timestamptz,
        created_at timestamptz DEFAULT now()
      )`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS assessment_ratings (
        id serial PRIMARY KEY,
        assessment_id integer NOT NULL REFERENCES assessments(id),
        domain_id integer NOT NULL REFERENCES life_domains(id),
        possibility integer NOT NULL,
        importance_now integer NOT NULL,
        importance_general integer NOT NULL,
        action integer NOT NULL,
        action_satisfaction integer NOT NULL,
        concern integer NOT NULL
      )`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS direction_narratives (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        cycle_id integer NOT NULL REFERENCES cycles(id),
        domain_id integer NOT NULL REFERENCES life_domains(id),
        raw_reflection text,
        narrative text,
        source varchar(12) NOT NULL DEFAULT 'human',
        accepted_at timestamptz,
        created_at timestamptz DEFAULT now()
      )`);

    // Every scale runs 1–10. ADD CONSTRAINT has no IF NOT EXISTS, so drop
    // first: both statements are inside the transaction, and the constraint is
    // only absent for the instant between them.
    for (const column of RATING_COLUMNS) {
      const name = `rating_${column}_range`;
      await client.query(
        `ALTER TABLE assessment_ratings DROP CONSTRAINT IF EXISTS ${name}`
      );
      await client.query(
        `ALTER TABLE assessment_ratings
           ADD CONSTRAINT ${name} CHECK (${column} BETWEEN 1 AND 10)`
      );
    }

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS cycles_user_label_unique
        ON cycles (user_id, label);
      CREATE UNIQUE INDEX IF NOT EXISTS assessment_ratings_assessment_domain_unique
        ON assessment_ratings (assessment_id, domain_id);
      CREATE UNIQUE INDEX IF NOT EXISTS direction_narratives_cycle_domain_unique
        ON direction_narratives (cycle_id, domain_id);
      CREATE INDEX IF NOT EXISTS idx_assessments_user_taken
        ON assessments (user_id, taken_at DESC);
    `);

    // One open draft per person, enforced here rather than hoped for: it makes
    // "two half-filled grids" unrepresentable and lets the draft be fetched
    // with a plain upsert.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS assessments_one_open_draft
        ON assessments (user_id) WHERE completed_at IS NULL
    `);

    // The twelve domains. Slug and position only — every name, description and
    // prompt lives in src/lib/i18n-assessment.ts, because the app is
    // bilingual. ON CONFLICT DO UPDATE so a reordering is fixed by re-running
    // rather than by hand.
    for (const [i, slug] of DOMAIN_SLUGS.entries()) {
      await client.query(
        `INSERT INTO life_domains (slug, position) VALUES ($1, $2)
           ON CONFLICT (slug) DO UPDATE SET position = EXCLUDED.position`,
        [slug, i + 1]
      );
    }
    console.log(`Seeded ${DOMAIN_SLUGS.length} life domains.`);

    await client.query("COMMIT");
    console.log("Values layer ready.");
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
