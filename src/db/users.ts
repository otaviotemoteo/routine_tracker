import { eq, isNull, and } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";
import { hashPassword, toHandle } from "@/lib/password";

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

// The session layer's one question: does the account a signed cookie names
// still exist? A cookie's signature and age say nothing about that — see
// src/lib/session.ts's resolveSessionUserId, the only caller.
export async function userExists(id: number): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, id));
  return row !== undefined;
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
  // The three starter practices this used to seed here (Oração/Terço/Leitura
  // bíblica) were, for every account but the one this app was migrated from,
  // already dead weight before Phase 3 — spiritual_practices rows with no
  // "espiritualidade" habit any new account could ever have to attach them
  // to (that kind was legacy-only, unreachable from the chooser or the AI
  // suggester). Phase 3 makes the kind reachable, but only by actually
  // creating a tracked habit — and seeding one unasked, the moment someone
  // sets their first password, would be a real habit appearing on Today that
  // nobody chose. Dropped rather than half-carried-forward; a genuine
  // starter practice list belongs behind a real "add this" moment, not a
  // side effect of claiming an account.
  return Boolean(row);
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
