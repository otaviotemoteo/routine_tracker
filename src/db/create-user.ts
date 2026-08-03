// Creates an account, with no password on it.
//
//   bun run user:create sofia
//
// The person signs in with that name and sets their own password on first
// access. This script and db:migrate are the ONLY ways an account comes into
// existence — there is deliberately no UI or API route that creates one.
import { createUser, findUserByName } from "./users";

async function main(): Promise<void> {
  const name = process.argv[2]?.trim();
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  if (!name) {
    console.error("Usage: bun run user:create <name>");
    process.exit(1);
  }
  if (name.length > 40) {
    console.error("Name is too long (40 characters max).");
    process.exit(1);
  }

  if (await findUserByName(name)) {
    console.error(`"${name}" already exists — nothing to do.`);
    process.exit(1);
  }

  const id = await createUser(name);
  if (id === null) {
    console.error(`"${name}" already exists — nothing to do.`);
    process.exit(1);
  }
  console.log(`Created "${name}" (id ${id}), unclaimed.`);
  console.log(
    "They sign in with that name and choose their password on first access."
  );
}

void main();
