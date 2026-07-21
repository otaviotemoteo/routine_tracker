import { defineConfig } from "drizzle-kit";

// drizzle-kit only auto-loads .env, not .env.local (where Next keeps
// secrets) — load it here so `bun run db:push` works out of the box.
// Already-set env vars (e.g. CI) are not overridden.
try {
  process.loadEnvFile(".env.local");
} catch {
  // fine: .env.local may not exist when DATABASE_URL comes from the environment
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
