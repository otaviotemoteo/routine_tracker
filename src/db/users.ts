import { eq } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";
import { hashPassword, toHandle } from "@/lib/password";

export interface AccountRow {
  id: number;
  name: string;
  passwordHash: string;
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

export async function getUserName(id: number): Promise<string | null> {
  const [row] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, id));
  return row?.name ?? null;
}

// Returns null when the name is taken — the caller turns that into a form
// error rather than a 500, since it's an ordinary thing for a user to hit.
export async function createUser(
  name: string,
  password: string
): Promise<number | null> {
  const handle = toHandle(name);
  if (await findUserByName(handle)) return null;

  const [row] = await db
    .insert(users)
    .values({
      name: name.trim(),
      handle,
      passwordHash: await hashPassword(password),
    })
    .returning({ id: users.id });
  return row.id;
}
