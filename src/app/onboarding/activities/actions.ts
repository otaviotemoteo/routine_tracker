"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createActivity, removeActivity, acceptProposedActivities } from "@/db/habits";
import { proposeActivities, type ActivityPick } from "@/lib/ai/propose-activities";
import type { ActivityProposal } from "@/lib/ai/activity-proposer";
import { slugify } from "@/lib/slugify";
import { getLang } from "@/lib/get-lang";
import { requireUserId } from "@/lib/session";
import { todayInSaoPaulo } from "@/lib/utils";

const HERE = "/onboarding/activities";

function safeNext(formData: FormData, fallback: string): string {
  const next = formData.get("next");
  return typeof next === "string" && next.startsWith("/") ? next : fallback;
}

// Kind is chosen by the model now, not picked by hand — see
// activity-proposer.ts. "plain" has no generic label the way the three rich
// kinds do (there's no one-word category for an arbitrary metric), so its
// activity is named after its own habit instead — see generateActivitiesAction.
const DEFAULT_NAME: Record<string, string> = {
  treino: "Treino",
  leitura: "Leitura",
  espiritualidade: "Espiritualidade",
};

function parsePicks(formData: FormData): ActivityPick[] {
  try {
    const parsed = JSON.parse(String(formData.get("picks") ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is { habitId: number; briefing: unknown } =>
          p && Number.isInteger(p.habitId) && p.habitId > 0
      )
      .map((p) => ({
        habitId: p.habitId,
        briefing:
          typeof p.briefing === "string" && p.briefing.trim() ? p.briefing.trim() : null,
      }));
  } catch {
    return [];
  }
}

// Shapes a fresh proposal into config-schemas.ts's real shape — ids starting
// at 1, everything active. This path never has an existing config to merge
// with (createActivity always inserts a NEW row — Decision 3,
// docs/ARCHITECTURE.md), so there's no retired-entry history to
// preserve the way rich-habits.ts's save* functions have to handle.
// "plain" carries no config at all — its content is the metric spine
// (metricType/unit/target/minimalAction), written directly onto the
// activity's own columns by the caller, same as ActivityForm.tsx's manual
// path.
function shapeConfig(proposal: ActivityProposal): unknown {
  switch (proposal.kind) {
    case "treino":
      return {
        planName: proposal.planName,
        days: proposal.days.map((d, i) => ({ id: i + 1, ...d, active: true })),
      };
    case "leitura":
      return {
        year: new Date().getFullYear(),
        // AI never calculates a target (config-schemas.ts's own rule) — the
        // count proposed is the only real number available yet, so it's the
        // honest default; /config lets it be changed the moment it's wrong.
        targetBooksPerYear: proposal.books.length,
        books: proposal.books.map((b, i) => ({
          id: i + 1,
          title: b.title,
          author: b.author ?? null,
          totalPages: b.totalPages,
          currentPage: 0,
          status: "queued" as const,
          position: i,
          startedAt: null,
          finishedAt: null,
        })),
      };
    case "espiritualidade": {
      const seen = new Set<string>();
      return {
        practices: proposal.practices
          .map((p, i) => ({
            slug: slugify(p.name),
            name: p.name,
            countable: p.countable,
            position: i,
            active: true,
          }))
          .filter((p) => p.slug && !seen.has(p.slug) && seen.add(p.slug)),
      };
    }
    case "plain":
      return null;
  }
}

// Turn every {habitId, briefing} pick into its own generation call (one each
// — see propose-activities.ts), then write each result as a PROPOSED
// activity (active_from NULL) — never straight to tracked. This is what
// makes the review step real: the old version of this screen wrote straight
// to config and redirected, with nothing left to actually review. See
// docs/ARCHITECTURE.md.
export async function generateActivitiesAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const lang = await getLang();
  const picks = parsePicks(formData);

  if (picks.length === 0) {
    redirect(safeNext(formData, HERE));
  }

  const outcome = await proposeActivities(userId, picks, lang);

  if (outcome.status === "nothing") {
    redirect(`${HERE}?failed=1`);
  }

  for (const { habitId, habitName, proposal, briefing } of outcome.perHabit) {
    const isPlain = proposal.kind === "plain";
    await createActivity(
      userId,
      habitId,
      {
        name: isPlain ? habitName : (DEFAULT_NAME[proposal.kind] ?? proposal.kind),
        metricType: isPlain ? proposal.metricType : "binary",
        unit: isPlain ? (proposal.unit ?? null) : null,
        target: isPlain ? (proposal.target ?? null) : null,
        minimalAction: isPlain ? (proposal.minimalAction ?? null) : null,
        templateKind: isPlain ? null : proposal.kind,
        config: shapeConfig(proposal),
      },
      { source: "ai_suggested", why: briefing, activeFrom: null }
    );
  }

  revalidatePath(HERE);
  // Every pick failed: same dead end as "nothing to propose" from the
  // person's point of view. Some failed, some didn't: still forward — a
  // partial batch a person can review beats a wall blocking the ones that
  // worked. Either way the failure count travels in the query string so the
  // review screen can name it rather than stay silent about the gap.
  const to =
    outcome.perHabit.length === 0
      ? `${HERE}?failed=1`
      : outcome.failed.length > 0
        ? `${safeNext(formData, HERE)}?partialFail=${outcome.failed.length}`
        : safeNext(formData, HERE);
  redirect(to);
}

// The review step's one write: every still-proposed activity for this
// account becomes real at once, habit's placeholder default activity
// retired where it applies (acceptProposedActivities, src/db/habits.ts).
export async function acceptActivitiesAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  await acceptProposedActivities(userId, todayInSaoPaulo());

  revalidatePath(HERE);
  revalidatePath("/config");
  revalidatePath("/");
  redirect(safeNext(formData, "/"));
}

// Discard one still-proposed activity from the review list — nothing can
// reference it yet, so this is a real delete (removeActivity's proposed
// path), not an archive.
export async function rejectActivityAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) redirect(HERE);

  await removeActivity(userId, id, todayInSaoPaulo());

  revalidatePath(HERE);
  redirect(safeNext(formData, HERE));
}
