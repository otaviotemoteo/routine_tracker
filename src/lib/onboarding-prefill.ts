import type { UserId } from "@/db/scope";
// Server-only prefill loaders for the /config step forms — one specific
// ACTIVITY's own current values now, not "the account's one of a kind". See
// docs/HABIT-VS-ACTIVITY-MODEL.md.
import {
  getReadingConfig,
  getSleepConfig,
  getWorkoutConfig,
  listLanguages,
  listRoutineBlocks,
  listSpiritualPractices,
} from "@/db/rich-habits";
import { daysLeftInYear, todayInSaoPaulo } from "@/lib/utils";

export async function workoutInitial(userId: UserId, activityId: number) {
  const workout = await getWorkoutConfig(userId, activityId);
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

export async function readingInitial(userId: UserId, activityId: number) {
  const today = todayInSaoPaulo();
  const year = Number(today.slice(0, 4));
  const reading = await getReadingConfig(userId, activityId);
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

export async function sleepInitial(userId: UserId, activityId: number) {
  const target = await getSleepConfig(userId, activityId);
  return {
    initialBedtime: target?.bedtime ?? "23:00",
    initialWake: target?.wakeTime ?? "06:30",
  };
}

export async function routineInitial(userId: UserId, activityId: number) {
  const blocks = await listRoutineBlocks(userId, activityId);
  return blocks.map((b) => ({
    startTime: b.startTime,
    endTime: b.endTime,
    activity: b.activity,
    weekdays: b.weekdays,
  }));
}

export async function duolingoInitial(userId: UserId, activityId: number) {
  return (await listLanguages(userId, activityId)).map((l) => l.name);
}

export async function spiritualityInitial(userId: UserId, activityId: number) {
  return (await listSpiritualPractices(userId, activityId)).map((p) => ({
    name: p.name,
    slug: p.slug,
    countable: p.countable,
  }));
}
