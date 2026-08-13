// Seeds the seven original habits onto ONE named account.
//
//   bun run db:seed <handle>
//
// It takes a handle now because habits are per-user. Before the remodel this
// wrote seven globally shared rows and every account saw them; that is exactly
// what stopped anyone but the owner from using the app.
//
// A new account is NOT seeded and should not be: a friend's habits come out of
// their own values check-in, and Today shows an empty state until they have
// some. This script exists for the owner's account and for restoring a
// development database, not as part of account creation.
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq } from "drizzle-orm";
import { habits, users } from "./schema";
import { toHandle } from "@/lib/password";

// Only load .env.local when DATABASE_URL isn't already set, so a shell-provided
// URL (CI, or local-proxy testing) takes precedence over the file.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // .env.local may not exist (e.g. CI with DATABASE_URL already set)
  }
}

// Same dev-only local proxy switch as src/db/index.ts (own connection here
// because env vars must load before the URL is read).
if (process.env.NEON_LOCAL_PROXY === "true") {
  neonConfig.fetchEndpoint = (host) => `http://${host}:4444/sql`;
}

// The emoji in `icon` mirrors the README schema; the UI never renders it —
// components map slug → lucide-react icon instead.
//
// template_kind equals the slug: these seven keep the original renderers,
// which read the per-domain tables. They are the ONLY habits allowed to carry
// a non-plain kind — see src/lib/templates.ts for why.
const SEED_HABITS = [
  { name: "Treino", slug: "treino", icon: "🏋️", optional: false, metricType: "binary" as const, unit: null },
  { name: "Leitura", slug: "leitura", icon: "📖", optional: false, metricType: "count" as const, unit: "pages" },
  { name: "Sono", slug: "sono", icon: "🌙", optional: false, metricType: "duration" as const, unit: "hours" },
  { name: "Rotina", slug: "rotina", icon: "⏰", optional: false, metricType: "count" as const, unit: "blocks" },
  { name: "Duolingo", slug: "duolingo", icon: "🌍", optional: false, metricType: "count" as const, unit: "lessons" },
  { name: "Espiritualidade", slug: "espiritualidade", icon: "✝️", optional: false, metricType: "count" as const, unit: "practices" },
  { name: "Hobby", slug: "hobby", icon: "🎸", optional: true, metricType: "duration" as const, unit: "minutes" },
];

async function seed(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set — fill .env.local first.");
    process.exit(1);
  }

  const name = process.argv[2];
  if (!name) {
    console.error("Usage: bun run db:seed <handle>");
    console.error("Habits are per-account, so this needs to know whose.");
    process.exit(1);
  }

  const db = drizzle(neon(url));
  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.handle, toHandle(name)));

  if (!user) {
    console.error(`No account named "${name}". Create it first:`);
    console.error(`  bun run user:create ${name}`);
    process.exit(1);
  }

  // active_from is today rather than null: null means "proposed but not
  // accepted" and would leave these invisible on Today. Seeded habits are
  // meant to be tracked immediately.
  const today = new Date().toISOString().slice(0, 10);

  for (const [i, habit] of SEED_HABITS.entries()) {
    await db
      .insert(habits)
      .values({
        userId: user.id,
        name: habit.name,
        slug: habit.slug,
        icon: habit.icon,
        optional: habit.optional,
        metricType: habit.metricType,
        unit: habit.unit,
        templateKind: habit.slug,
        source: "human",
        position: i + 1,
        activeFrom: today,
      })
      .onConflictDoUpdate({
        target: [habits.userId, habits.slug],
        set: {
          name: habit.name,
          icon: habit.icon,
          optional: habit.optional,
          position: i + 1,
        },
      });
  }
  console.log(`Seeded ${SEED_HABITS.length} habits for ${user.name}.`);
}

// Re-runnable: the upsert keys on (user_id, slug) and never touches
// active_from on an existing row, so re-seeding can't reset someone's history.
seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
