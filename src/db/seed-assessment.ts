// Backfills a values assessment answered somewhere other than the app — on
// paper, in a spreadsheet, in a conversation.
//
//   bun run assessment:seed answers.json
//
// The file it reads is yours and is not in the repository: keep it out of git,
// it is a description of your life. `answers.example.json` shows the shape.
//
// It writes through the same validation and the same prioritize() the app uses,
// so a grid that lands here is a grid the app would have produced. It refuses
// to touch a cycle that already holds a sealed assessment — that record is
// closed, and the way to correct one is to void it, not to overwrite it.
//
// `ratings` is optional. A file with only `directions` writes the written half
// on its own, which is what you want when the numbers are going to be answered
// in the app but the reflections already exist on paper: seed them first and
// the writing step opens with your own words already in it, to review rather
// than retype. It does NOT prefill any rating, ever — see getOpenDraft.
//
// node-postgres over plain TCP, not the app's neon-http driver: this writes an
// assessment, its twelve ratings and its narratives, and either all of it lands
// or none of it does.
import { readFileSync } from "node:fs";
import pg from "pg";
import { z } from "zod";
import { prioritize, type DomainRatings } from "@/lib/diagnose";
import { DOMAIN_SLUGS, SCALE_MAX, SCALE_MIN } from "@/lib/domains";
import { cycleBounds, cycleLabel } from "./assessment";

const scale = z.number().int().min(SCALE_MIN).max(SCALE_MAX);

const ratingSchema = z
  .object({
    possibility: scale,
    importanceNow: scale,
    importanceGeneral: scale,
    action: scale,
    actionSatisfaction: scale,
    concern: scale,
  })
  .strict();

const fileSchema = z
  .object({
    // The São Paulo day the grid was actually filled in, not today.
    takenAt: z.string().date(),
    handle: z.string().min(1),
    contextNote: z.string().optional(),
    // Omit to write only the directions. Present means all twelve, because a
    // partial grid is not a weaker grid — it is one that cannot be compared to
    // the next cycle, which is the only reason to keep it.
    ratings: z
      .object(Object.fromEntries(DOMAIN_SLUGS.map((slug) => [slug, ratingSchema])))
      .optional(),
    directions: z
      .record(
        z.enum(DOMAIN_SLUGS),
        z.object({
          rawReflection: z.string().optional(),
          narrative: z.string().optional(),
        })
      )
      .optional(),
  })
  .strict();

async function main(): Promise<void> {
  const path = process.argv[2];
  const url = process.env.DATABASE_URL;
  if (!path) {
    console.error("Usage: bun run assessment:seed <answers.json>");
    process.exit(1);
  }
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const parsed = fileSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.success) {
    console.error(`${path} is not a valid answer file:`);
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    process.exit(1);
  }
  const answers = parsed.data;

  const ratings = answers.ratings as DomainRatings | undefined;
  const label = cycleLabel(answers.takenAt);
  const { startsAt, endsAt } = cycleBounds(answers.takenAt);

  const pool = new pg.Pool({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: true },
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const user = await client.query<{ id: number }>(
      "SELECT id FROM users WHERE handle = $1",
      [answers.handle.toLowerCase()]
    );
    if (!user.rowCount) {
      throw new Error(
        `No account with handle "${answers.handle}". Create it with: bun run user:create <name>`
      );
    }
    const userId = user.rows[0].id;

    await client.query(
      `INSERT INTO cycles (user_id, label, starts_at, ends_at)
         VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, label) DO NOTHING`,
      [userId, label, startsAt, endsAt]
    );
    const cycle = await client.query<{ id: number }>(
      "SELECT id FROM cycles WHERE user_id = $1 AND label = $2",
      [userId, label]
    );
    const cycleId = cycle.rows[0].id;

    const domains = await client.query<{ id: number; slug: string }>(
      "SELECT id, slug FROM life_domains"
    );
    const domainId = new Map(domains.rows.map((d) => [d.slug, d.id]));

    if (ratings && answers.ratings) {
      const sealed = await client.query<{ id: number; taken_at: string }>(
        // to_char, because node-postgres would hand back a Date and the message
        // would print a timezone nobody asked about.
        `SELECT id, to_char(taken_at, 'YYYY-MM-DD') AS taken_at FROM assessments
          WHERE user_id = $1 AND cycle_id = $2
            AND completed_at IS NOT NULL AND voided_at IS NULL`,
        [userId, cycleId]
      );
      if (sealed.rowCount) {
        throw new Error(
          `${label} already holds a sealed assessment (id ${sealed.rows[0].id}, ` +
            `taken ${sealed.rows[0].taken_at}). A sealed record is not overwritten. ` +
            `To replace it, set its voided_at first — the original stays on disk.`
        );
      }

      // Any open draft for this cycle is superseded by what's in the file.
      await client.query(
        `DELETE FROM assessment_ratings WHERE assessment_id IN (
           SELECT id FROM assessments
            WHERE user_id = $1 AND cycle_id = $2 AND completed_at IS NULL)`,
        [userId, cycleId]
      );
      await client.query(
        `DELETE FROM assessments
          WHERE user_id = $1 AND cycle_id = $2 AND completed_at IS NULL`,
        [userId, cycleId]
      );

      const priority = prioritize(ratings);
      const assessment = await client.query<{ id: number }>(
        `INSERT INTO assessments
           (user_id, cycle_id, taken_at, kind, context_note, priority_domains, completed_at)
         VALUES ($1, $2, $3, 'full', $4, $5, now()) RETURNING id`,
        [userId, cycleId, answers.takenAt, answers.contextNote ?? null, priority]
      );
      const assessmentId = assessment.rows[0].id;

      for (const slug of DOMAIN_SLUGS) {
        const r = answers.ratings[slug];
        await client.query(
          `INSERT INTO assessment_ratings
             (assessment_id, domain_id, possibility, importance_now,
              importance_general, action, action_satisfaction, concern)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            assessmentId,
            domainId.get(slug),
            r.possibility,
            r.importanceNow,
            r.importanceGeneral,
            r.action,
            r.actionSatisfaction,
            r.concern,
          ]
        );
      }
      console.log(`Sealed assessment ${assessmentId} for ${label}, 12 domains.`);
      console.log(`Priority: ${priority.join(", ")}`);
    } else {
      console.log(`No ratings in the file, so none were written.`);
      console.log(`The grid stays for the app to ask; only the writing lands here.`);
    }

    let written = 0;
    for (const [slug, direction] of Object.entries(answers.directions ?? {})) {
      if (!direction?.rawReflection && !direction?.narrative) continue;
      await client.query(
        `INSERT INTO direction_narratives
           (user_id, cycle_id, domain_id, raw_reflection, narrative, source, accepted_at)
         VALUES ($1, $2, $3, $4, $5, 'human', now())
         ON CONFLICT (cycle_id, domain_id) DO UPDATE SET
           raw_reflection = EXCLUDED.raw_reflection,
           narrative = EXCLUDED.narrative,
           accepted_at = EXCLUDED.accepted_at`,
        [
          userId,
          cycleId,
          domainId.get(slug),
          direction.rawReflection ?? null,
          direction.narrative ?? null,
        ]
      );
      written++;
    }
    if (written) console.log(`Wrote ${written} direction narratives.`);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Rolled back — nothing was written.");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
