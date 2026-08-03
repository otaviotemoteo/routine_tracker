import { eq, isNull, and } from "drizzle-orm";
import { db } from "./index";
import { spiritualPractices, users } from "./schema";
import { hashPassword, toHandle } from "@/lib/password";

// Practices are per-account, so a new account starts with the same three
// defaults the app has always shipped. Editable in onboarding like everything
// else; this is a starting point, not a fixed list.
const DEFAULT_PRACTICES = [
  { name: "Oração", slug: "oracao", countable: false, position: 0 },
  { name: "Terço", slug: "terco", countable: true, position: 1 },
  { name: "Leitura bíblica", slug: "leitura-biblica", countable: false, position: 2 },
];

export interface AccountRow {
  id: number;
  name: string;
  // NULL until the account is claimed on its first sign-in.
  passwordHash: string | null;
}

export async function findUserByName(name: string): Promise<AccountRow | null> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.handle, toHandle(name)));
  return row ?? null;
}

// Claim: set the first password on an account that has none. The `IS NULL`
// guard is in the WHERE clause, so two people racing to claim the same name
// can't both win — the second update matches no row.
export async function claimAccount(
  id: number,
  password: string
): Promise<boolean> {
  const [row] = await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(and(eq(users.id, id), isNull(users.passwordHash)))
    .returning({ id: users.id });
  if (!row) return false;

  await db
    .insert(spiritualPractices)
    .values(DEFAULT_PRACTICES.map((p) => ({ userId: id, ...p, active: true })))
    .onConflictDoNothing();
  return true;
}

// Script-only (bun run user:password): there is no self-service reset.
export async function changePassword(
  id: number,
  password: string
): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, id));
}

// Script-only (bun run user:create). There is deliberately no API or UI path
// that reaches this.
export async function createUser(name: string): Promise<number | null> {
  const handle = toHandle(name);
  if (await findUserByName(handle)) return null;
  const [row] = await db
    .insert(users)
    .values({ name: name.trim(), handle, passwordHash: null })
    .returning({ id: users.id });
  return row.id;
}
