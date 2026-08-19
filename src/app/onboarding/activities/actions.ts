"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { promoteToRichKind } from "@/db/habits";
import { proposeActivities, type ActivityPick } from "@/lib/ai/propose-activities";
import type { ActivityProposal } from "@/lib/ai/activity-proposer";
import { slugify } from "@/lib/slugify";
import { getLang } from "@/lib/get-lang";
import { requireUserId } from "@/lib/session";

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

function parsePicks(formData: FormData): ActivityPick[] {
  try {
    const parsed = JSON.parse(String(formData.get("picks") ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is ActivityPick =>
        p &&
        Number.isInteger(p.habitId) &&
        p.habitId > 0 &&
        typeof p.kind === "string" &&
        PROPOSABLE.has(p.kind)
    );
  } catch {
    return [];
  }
}

// Shapes a fresh proposal into config-schemas.ts's real shape — ids starting
// at 1, everything active. This path never has an existing config to merge
// with (promoteToRichKind is only ever reached from 'plain' or a re-run of
// the SAME kind — see its own comment), so there's no retired-entry history
// to preserve the way rich-habits.ts's save* functions have to handle.
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

// The one action on this screen: turn every {habitId, kind} pick into ONE
// batched generation, then write each result immediately — see
// HABIT-VS-ACTIVITY-MODEL.md and the Phase plan for why this step skips a
// separate "accept" click (unlike proposed HABITS, there's no lightweight
// "not yet real" row shape for a nested config the way active_from gives
// habits one) and instead treats "look at what got made and remove anything
// unwanted" — already possible via /config's existing edit path — as the
// review step.
export async function generateActivitiesAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const lang = await getLang();
  const picks = parsePicks(formData);

  if (picks.length === 0) {
    redirect(safeNext(formData, HERE));
  }

  const outcome = await proposeActivities(userId, picks, lang, null);

  if (outcome.status === "ok") {
    for (const { habitId, proposal } of outcome.perHabit) {
      await promoteToRichKind(userId, habitId, proposal.kind, shapeConfig(proposal));
    }
  }

  revalidatePath(HERE);
  revalidatePath("/config");
  revalidatePath("/");
  redirect(outcome.status === "ok" ? safeNext(formData, HERE) : `${HERE}?failed=1`);
}
