"use server";

import { redirect } from "next/navigation";
import {
  createBook,
  replaceLanguages,
  replaceRoutineBlocks,
  replaceSpiritualPractices,
  saveReadingList,
  saveWorkoutPlan,
  upsertReadingGoal,
  upsertSleepTarget,
} from "@/db/queries";
import type { PlannedExercise } from "@/db/schema";
import { slugify } from "@/lib/onboarding";
import { todayInSaoPaulo } from "@/lib/utils";
import { requireUserId } from "@/lib/session";

// Each step form carries a hidden `next` = where to go after saving:
// the following wizard step (onboarding) or back to /config. Only same-origin
// paths are honored.
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

export async function saveWorkoutStep(formData: FormData): Promise<void> {
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
  if (days.length > 0) await saveWorkoutPlan(userId, name, days);
  redirect(safeNext(formData));
}

export async function saveReadingStep(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const target = Number(formData.get("targetBooks"));
  if (Number.isFinite(target) && target > 0) {
    await upsertReadingGoal(userId, Number(todayInSaoPaulo().slice(0, 4)), target);
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
      status: b.reading ? "reading" : "queued",
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
  await saveReadingList(userId, books);
  redirect(safeNext(formData));
}

export async function saveSleepStep(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const bedtime = String(formData.get("bedtime") || "").trim();
  const wake = String(formData.get("wakeTime") || "").trim();
  if (/^\d{2}:\d{2}$/.test(bedtime) && /^\d{2}:\d{2}$/.test(wake)) {
    await upsertSleepTarget(userId, bedtime, wake);
  }
  redirect(safeNext(formData));
}

export async function saveRoutineStep(formData: FormData): Promise<void> {
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
  await replaceRoutineBlocks(userId, blocks);
  redirect(safeNext(formData));
}

export async function saveDuolingoStep(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const seen = new Set<string>();
  const items = parseJsonArray(formData)
    .map((l) => String((l as Record<string, unknown>).name ?? "").trim())
    .filter(Boolean)
    .map((name) => ({ name, slug: slugify(name) }))
    .filter((l) => l.slug && !seen.has(l.slug) && seen.add(l.slug));
  await replaceLanguages(userId, items);
  redirect(safeNext(formData));
}

export async function saveSpiritualityStep(formData: FormData): Promise<void> {
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
  await replaceSpiritualPractices(userId, practices);
  redirect(safeNext(formData));
}

// Finishes the wizard and goes home. The (app) gate no longer reads a cookie
// here — it derives completion from whether the account has an active habit
// (see src/app/(app)/layout.tsx), which this route doesn't create on its own.
export async function finishOnboarding(): Promise<void> {
  await requireUserId();
  redirect("/");
}
