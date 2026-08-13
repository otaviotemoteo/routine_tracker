// The two writes behind the churn column. See src/lib/first-run.ts for why
// there is only one column and what its null means.
import { eq, isNotNull, sql } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";
import type { UserId } from "./scope";
import type { FirstRunStep } from "@/lib/first-run";

// Called on every advance through the first run. Cheap enough to sit inside
// the actions that already write on advance — one indexed UPDATE by primary
// key, alongside a write that was happening anyway.
export async function markFirstRunStep(
  userId: UserId,
  step: FirstRunStep
): Promise<void> {
  await db
    .update(users)
    .set({ firstRunStep: step })
    .where(eq(users.id, userId));
}

// Called once, when the run completes at "Start tracking". Setting it back to
// null is what makes a non-null value mean "abandoned" rather than merely
// "was here once".
export async function clearFirstRunStep(userId: UserId): Promise<void> {
  await db
    .update(users)
    .set({ firstRunStep: null })
    .where(eq(users.id, userId));
}

// The churn report. Not wired to a screen — it is a question asked rarely, by
// the one person who runs the app, and a dashboard for it would be more
// machinery than the signal is worth.
export async function firstRunChurn(): Promise<
  { step: string; count: number }[]
> {
  const rows = await db
    .select({
      step: users.firstRunStep,
      count: sql<number>`count(*)::int`,
    })
    .from(users)
    .where(isNotNull(users.firstRunStep))
    .groupBy(users.firstRunStep);
  return rows.map((r) => ({ step: r.step ?? "", count: r.count }));
}
