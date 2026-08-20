"use server";

// The six "daily stuff" save actions. Originally the old onboarding wizard's
// own actions file, shared with /config from the start (the wizard route
// itself is gone — /config is now their only caller, so this is where they
// live).
//
// Each takes the ACTIVITY id being edited as its first argument, bound in by
// the page (`saveWorkoutStep.bind(null, activityId)`) rather than carried as
// a hidden field — a bound Server Action is still a valid `<form action>`,
// and the six step components below need no change to their own action prop
// type to pass it through. See docs/HABIT-VS-ACTIVITY-MODEL.md.
import { redirect } from "next/navigation";
import {
  getReadingConfig,
  saveLanguages,
  saveReadingList,
  saveRoutineBlocks,
  saveSleepTarget,
  saveSpiritualPractices,
  saveWorkoutPlan,
} from "@/db/rich-habits";
import type { PlannedExercise } from "@/db/schema";
import { slugify } from "@/lib/slugify";
import { todayInSaoPaulo } from "@/lib/utils";
import { requireUserId } from "@/lib/session";

// Each step form carries a hidden `next` = where to go after saving, back to
// /config or wherever it was opened from. Only same-origin paths are honored.
function safeNext(formData: FormData): string {
  const next = formData.get("next");
  return typeof next === "string" && next.startsWith("/") ? next : "/";
}

function parseJsonArray(formData: FormData): unknown[] {
  try {
    const parsed = JSON.parse(String(formData.get("data") ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveWorkoutStep(
  activityId: number,
  formData: FormData
): Promise<void> {
  const userId = await requireUserId();
  const name = String(formData.get("planName") || "").trim() || "Meu plano";
  const days = parseJsonArray(formData)
    .map((d) => d as Record<string, unknown>)
    .filter((d) => String(d.focus ?? "").trim())
    .map((d) => ({
      weekday: Number(d.weekday),
      focus: String(d.focus).trim(),
      exercises: Array.isArray(d.exercises)
        ? (d.exercises as PlannedExercise[])
        : [],
    }))
    .filter((d) => d.weekday >= 1 && d.weekday <= 7);
  if (days.length > 0) await saveWorkoutPlan(userId, activityId, name, days);
  redirect(safeNext(formData));
}

export async function saveReadingStep(
  activityId: number,
  formData: FormData
): Promise<void> {
  const userId = await requireUserId();
  const year = Number(todayInSaoPaulo().slice(0, 4));
  const submittedTarget = Number(formData.get("targetBooks"));
  // A blank/invalid target field leaves the existing goal untouched — the
  // same rule the old upsertReadingGoal call had by simply not being called
  // in that case. saveReadingList always writes year+target together now, so
  // "untouched" here means "carry the current value forward" rather than
  // "skip the write".
  let targetBooksPerYear = 0;
  if (Number.isFinite(submittedTarget) && submittedTarget > 0) {
    targetBooksPerYear = submittedTarget;
  } else {
    const current = await getReadingConfig(userId, activityId);
    if (current && current.year === year) targetBooksPerYear = current.targetBooksPerYear;
  }
  const rows = parseJsonArray(formData)
    .map((b) => b as Record<string, unknown>)
    .filter((b) => String(b.title ?? "").trim() && Number(b.pages) > 0);
  const books = rows.map((b, i) => {
    const totalPages = Number(b.pages);
    const current = Number(b.currentPage);
    return {
      id: Number(b.id) || undefined,
      title: String(b.title).trim(),
      author: String(b.author ?? "").trim() || null,
      totalPages,
      // Current page only applies to the book being read; clamp to the total.
      currentPage:
        b.reading && Number.isFinite(current) && current > 0
          ? Math.min(current, totalPages)
          : 0,
      // First book flagged "reading now" becomes the current book.
      status: (b.reading ? "reading" : "queued") as
        | "reading"
        | "queued",
      position: i,
    };
  });
  // Keep only the first "reading" to avoid two current books.
  let seenReading = false;
  for (const b of books) {
    if (b.status === "reading") {
      if (seenReading) {
        b.status = "queued";
        b.currentPage = 0;
      }
      seenReading = true;
    }
  }
  await saveReadingList(userId, activityId, year, targetBooksPerYear, books);
  redirect(safeNext(formData));
}

export async function saveSleepStep(
  activityId: number,
  formData: FormData
): Promise<void> {
  const userId = await requireUserId();
  const bedtime = String(formData.get("bedtime") || "").trim();
  const wake = String(formData.get("wakeTime") || "").trim();
  if (/^\d{2}:\d{2}$/.test(bedtime) && /^\d{2}:\d{2}$/.test(wake)) {
    await saveSleepTarget(userId, activityId, bedtime, wake);
  }
  redirect(safeNext(formData));
}

export async function saveRoutineStep(
  activityId: number,
  formData: FormData
): Promise<void> {
  const userId = await requireUserId();
  const blocks = parseJsonArray(formData)
    .map((b) => b as Record<string, unknown>)
    .filter(
      (b) =>
        String(b.activity ?? "").trim() &&
        /^\d{2}:\d{2}$/.test(String(b.startTime ?? "")) &&
        /^\d{2}:\d{2}$/.test(String(b.endTime ?? ""))
    )
    .map((b, i) => ({
      startTime: String(b.startTime),
      endTime: String(b.endTime),
      activity: String(b.activity).trim(),
      weekdays: Array.isArray(b.weekdays)
        ? (b.weekdays as unknown[]).map(Number).filter((n) => n >= 1 && n <= 7)
        : [],
      position: i,
    }))
    .filter((b) => b.weekdays.length > 0);
  await saveRoutineBlocks(userId, activityId, blocks);
  redirect(safeNext(formData));
}

export async function saveDuolingoStep(
  activityId: number,
  formData: FormData
): Promise<void> {
  const userId = await requireUserId();
  const seen = new Set<string>();
  const items = parseJsonArray(formData)
    .map((l) => String((l as Record<string, unknown>).name ?? "").trim())
    .filter(Boolean)
    .map((name) => ({ name, slug: slugify(name) }))
    .filter((l) => l.slug && !seen.has(l.slug) && seen.add(l.slug));
  await saveLanguages(userId, activityId, items);
  redirect(safeNext(formData));
}

export async function saveSpiritualityStep(
  activityId: number,
  formData: FormData
): Promise<void> {
  const userId = await requireUserId();
  const seen = new Set<string>();
  const practices = parseJsonArray(formData)
    .map((p) => p as Record<string, unknown>)
    .map((p, i) => ({
      name: String(p.name ?? "").trim(),
      slug: slugify(String(p.slug ?? p.name ?? "")),
      countable: Boolean(p.countable),
      position: i,
    }))
    .filter((p) => p.name && p.slug && !seen.has(p.slug) && seen.add(p.slug));
  await saveSpiritualPractices(userId, activityId, practices);
  redirect(safeNext(formData));
}
