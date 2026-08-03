// Sets someone's password, for when they ask you to reset it.
//
//   bun run user:password sofia
//
// There is no self-service reset in the app on purpose — this script is it.
// Passing the password as an argument would leave it in your shell history, so
// it's read from a prompt instead.
import { createInterface } from "node:readline/promises";
import { changePassword, findUserByName } from "./users";
import { isPasswordValid, MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

async function main(): Promise<void> {
  const name = process.argv[2]?.trim();
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  if (!name) {
    console.error("Usage: bun run user:password <name>");
    process.exit(1);
  }

  const user = await findUserByName(name);
  if (!user) {
    console.error(`No account named "${name}".`);
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = (
    await rl.question(`New password for "${user.name}": `)
  ).trim();
  rl.close();

  if (!isPasswordValid(password)) {
    console.error(
      `Needs at least ${MIN_PASSWORD_LENGTH} characters, a number and a special character.`
    );
    process.exit(1);
  }

  await changePassword(user.id, password);
  console.log(`Password set for "${user.name}".`);
}

void main();
