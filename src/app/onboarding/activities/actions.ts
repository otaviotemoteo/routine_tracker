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

const PROPOSABLE: ReadonlySet<string> = new Set([
  "treino",
  "leitura",
  "rotina",
  "duolingo",
  "espiritualidade",
]);

const DEFAULT_NAME: Record<string, string> = {
  treino: "Treino",
  leitura: "Leitura",
  rotina: "Rotina",
  duolingo: "Duolingo",
  espiritualidade: "Espiritualidade",
};

function parsePicks(formData: FormData): ActivityPick[] {
  try {
    const parsed = JSON.parse(String(formData.get("picks") ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is { habitId: number; kind: string; briefing: unknown } =>
          p &&
          Number.isInteger(p.habitId) &&
          p.habitId > 0 &&
          typeof p.kind === "string" &&
          PROPOSABLE.has(p.kind)
      )
      .map((p) => ({
        habitId: p.habitId,
        kind: p.kind as ActivityPick["kind"],
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
// docs/HABIT-VS-ACTIVITY-MODEL.md), so there's no retired-entry history to
// preserve the way rich-habits.ts's save* functions have to handle.
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
    case "rotina":
      return {
        blocks: proposal.blocks.map((b, i) => ({
          id: i + 1,
          startTime: b.startTime,
          endTime: b.endTime,
          activity: b.activity,
          weekdays: b.weekdays,
          position: i,
          active: true,
        })),
      };
    case "duolingo": {
      const seen = new Set<string>();
      return {
        languages: proposal.languages
          .map((l) => ({ slug: slugify(l.name), name: l.name, active: true }))
          .filter((l) => l.slug && !seen.has(l.slug) && seen.add(l.slug)),
      };
    }
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
  }
}

// Turn every {habitId, kind, briefing} pick into ONE batched generation, then
// write each result as a PROPOSED activity (active_from NULL) — never
// straight to tracked. This is what makes the review step real: the old
// version of this screen wrote straight to config and redirected, with
// nothing left to actually review. See docs/HABIT-VS-ACTIVITY-MODEL.md.
export async function generateActivitiesAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const lang = await getLang();
  const picks = parsePicks(formData);

  if (picks.length === 0) {
    redirect(safeNext(formData, HERE));
  }

  const outcome = await proposeActivities(userId, picks, lang, null);

  if (outcome.status === "ok") {
    for (const { habitId, proposal, briefing } of outcome.perHabit) {
      await createActivity(
        userId,
        habitId,
        {
          name: DEFAULT_NAME[proposal.kind] ?? proposal.kind,
          metricType: "binary",
          unit: null,
          target: null,
          minimalAction: null,
          templateKind: proposal.kind,
          config: shapeConfig(proposal),
        },
        { source: "ai_suggested", why: briefing, activeFrom: null }
      );
    }
  }

  revalidatePath(HERE);
  redirect(outcome.status === "ok" ? safeNext(formData, HERE) : `${HERE}?failed=1`);
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
