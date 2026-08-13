import type { ComponentType } from "react";
import type { SheetBodyProps } from "./types";
import { WorkoutBody } from "./WorkoutBody";
import { ReadingBody } from "./ReadingBody";
import { SleepBody } from "./SleepBody";
import { RoutineBody } from "./RoutineBody";
import { DuolingoBody } from "./DuolingoBody";
import { SpiritualityBody } from "./SpiritualityBody";
import { HobbyBody } from "./HobbyBody";
import { PlainBody } from "./PlainBody";
import { templateKindOf } from "@/lib/templates";

// Template kind → its detail-sheet body. Keyed on the kind rather than the
// slug, because slugs are per-account now and two people may both have one
// called "leitura" without both meaning a reading habit.
const BODIES: Record<string, ComponentType<SheetBodyProps>> = {
  treino: WorkoutBody,
  leitura: ReadingBody,
  sono: SleepBody,
  rotina: RoutineBody,
  duolingo: DuolingoBody,
  espiritualidade: SpiritualityBody,
  hobby: HobbyBody,
  plain: PlainBody,
};

// Always resolves to something: an unknown or absent kind is a plain habit,
// so there is no longer a note-only fallback with no form at all.
export function sheetBodyFor(
  templateKind: string | null
): ComponentType<SheetBodyProps> {
  return BODIES[templateKindOf(templateKind)] ?? PlainBody;
}
