// Idempotent seed of the 7 habits (upsert by slug). Run with: bun run db:seed
// The emoji in `icon` mirrors the README schema; the UI never renders it —
// components map slug → lucide-react icon instead.
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { habits, spiritualPractices } from "./schema";

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

const SEED_HABITS = [
  { name: "Treino", slug: "treino", icon: "🏋️", optional: false },
  { name: "Leitura", slug: "leitura", icon: "📖", optional: false },
  { name: "Sono", slug: "sono", icon: "🌙", optional: false },
  { name: "Rotina", slug: "rotina", icon: "⏰", optional: false },
  { name: "Duolingo", slug: "duolingo", icon: "🌍", optional: false },
  { name: "Espiritualidade", slug: "espiritualidade", icon: "✝️", optional: false },
  { name: "Hobby", slug: "hobby", icon: "🎸", optional: true },
];

// Default spiritual practices (pt-BR — user content, editable in onboarding).
// countable = has a repetition count (e.g. 2 terços); others are just did/didn't.
const SEED_PRACTICES = [
  { name: "Oração", slug: "oracao", countable: false, position: 0 },
  { name: "Terço", slug: "terco", countable: true, position: 1 },
  { name: "Leitura bíblica", slug: "leitura-biblica", countable: false, position: 2 },
];

async function seed(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set — fill .env.local first.");
    process.exit(1);
  }
  const db = drizzle(neon(url));

  for (const habit of SEED_HABITS) {
    await db
      .insert(habits)
      .values(habit)
      .onConflictDoUpdate({
        target: habits.slug,
        set: { name: habit.name, icon: habit.icon, optional: habit.optional },
      });
  }
  for (const practice of SEED_PRACTICES) {
    await db
      .insert(spiritualPractices)
      .values({ ...practice, active: true })
      .onConflictDoUpdate({
        target: spiritualPractices.slug,
        set: {
          name: practice.name,
          countable: practice.countable,
          position: practice.position,
        },
      });
  }
  console.log(
    `Seeded ${SEED_HABITS.length} habits and ${SEED_PRACTICES.length} spiritual practices (upsert by slug).`
  );
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
