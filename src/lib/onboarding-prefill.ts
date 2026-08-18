import type { UserId } from "@/db/scope";
// Server-only prefill loaders for the onboarding/config step forms — shared so
// the wizard and the settings page show the same current values.
import {
  getReadingConfig,
  getSleepConfig,
  getWorkoutConfig,
  listLanguages,
  listRoutineBlocks,
  listSpiritualPractices,
} from "@/db/rich-habits";
import { daysLeftInYear, todayInSaoPaulo } from "@/lib/utils";

export async function workoutInitial(userId: UserId) {
  const workout = await getWorkoutConfig(userId);
  return {
    initialName: workout?.planName ?? "",
    initialDays:
      workout?.days
        .filter((d) => d.active)
        .map((d) => ({
          weekday: d.weekday,
          focus: d.focus,
          exercises: d.exercises,
        })) ?? [],
  };
}

export async function readingInitial(userId: UserId) {
  const today = todayInSaoPaulo();
  const year = Number(today.slice(0, 4));
  const reading = await getReadingConfig(userId);
  return {
    daysLeft: daysLeftInYear(today),
    year,
    // The goal is per-year — a target saved in an earlier year prefills
    // empty, same as the old getReadingGoal(userId, year) exact-year lookup,
    // so a new year prompts a fresh number rather than quietly reusing last
    // year's.
    initialGoal:
      reading?.year === year && reading.targetBooksPerYear
        ? String(reading.targetBooksPerYear)
        : "",
    initialBooks: (reading?.books ?? []).map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author ?? "",
      pages: String(b.totalPages),
      currentPage: b.currentPage ? String(b.currentPage) : "",
      reading: b.status === "reading",
    })),
  };
}

export async function sleepInitial(userId: UserId) {
  const target = await getSleepConfig(userId);
  return {
    initialBedtime: target?.bedtime ?? "23:00",
    initialWake: target?.wakeTime ?? "06:30",
  };
}

export async function routineInitial(userId: UserId) {
  const blocks = await listRoutineBlocks(userId);
  return blocks.map((b) => ({
    startTime: b.startTime,
    endTime: b.endTime,
    activity: b.activity,
    weekdays: b.weekdays,
  }));
}

export async function duolingoInitial(userId: UserId) {
  return (await listLanguages(userId)).map((l) => l.name);
}

export async function spiritualityInitial(userId: UserId) {
  return (await listSpiritualPractices(userId)).map((p) => ({
    name: p.name,
    slug: p.slug,
    countable: p.countable,
  }));
}
