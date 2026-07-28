import type { PlannedExercise } from "@/db/schema";

// The compact "how much" label for a planned exercise — "3×8", "3×45s",
// "5 km · 30 min". Units are symbols, so this reads the same in both
// languages and needs no copy.
export function exerciseScheme(ex: PlannedExercise): string {
  const kind = ex.kind ?? "reps";

  if (kind === "distance") {
    const parts: string[] = [];
    if (ex.distance) parts.push(`${ex.distance} km`);
    if (ex.minutes) parts.push(`${ex.minutes} min`);
    return parts.join(" · ");
  }

  if (kind === "time") {
    if (!ex.seconds) return ex.sets ? `${ex.sets}×` : "";
    const hold =
      ex.seconds >= 60 && ex.seconds % 60 === 0
        ? `${ex.seconds / 60} min`
        : `${ex.seconds}s`;
    return ex.sets ? `${ex.sets}×${hold}` : hold;
  }

  if (ex.sets && ex.reps) return `${ex.sets}×${ex.reps}`;
  if (ex.sets) return `${ex.sets}×`;
  return ex.reps ? `${ex.reps}` : "";
}
