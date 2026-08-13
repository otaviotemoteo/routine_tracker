import type { UserId } from "@/db/scope";
// Server-only prefill loaders for the onboarding/config step forms — shared so
// the wizard and the settings page show the same current values.
import {
  getActiveWorkoutPlan,
  getReadingGoal,
  getSleepTarget,
  listBooks,
  listLanguages,
  listRoutineBlocks,
  listSpiritualPractices,
} from "@/db/queries";
import { daysLeftInYear, todayInSaoPaulo } from "@/lib/utils";

export async function workoutInitial(userId: UserId) {
  const plan = await getActiveWorkoutPlan(userId);
  return {
    initialName: plan?.name ?? "",
    initialDays:
      plan?.days.map((d) => ({
        weekday: d.weekday,
        focus: d.focus,
        exercises: d.exercises,
      })) ?? [],
  };
}

export async function readingInitial(userId: UserId) {
  const today = todayInSaoPaulo();
  const [goal, books] = await Promise.all([
    getReadingGoal(userId, Number(today.slice(0, 4))),
    listBooks(userId),
  ]);
  return {
    daysLeft: daysLeftInYear(today),
    year: Number(today.slice(0, 4)),
    initialGoal: goal ? String(goal.targetBooks) : "",
    initialBooks: books.map((b) => ({
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
  const target = await getSleepTarget(userId);
  return {
    initialBedtime: target?.bedtime.slice(0, 5) ?? "23:00",
    initialWake: target?.wakeTime.slice(0, 5) ?? "06:30",
  };
}

export async function routineInitial(userId: UserId) {
  const blocks = await listRoutineBlocks(userId);
  return blocks.map((b) => ({
    startTime: b.startTime.slice(0, 5),
    endTime: b.endTime.slice(0, 5),
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
