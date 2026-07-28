import type { ComponentType } from "react";
import type { SheetBodyProps } from "./types";
import { WorkoutBody } from "./WorkoutBody";
import { ReadingBody } from "./ReadingBody";
import { SleepBody } from "./SleepBody";
import { RoutineBody } from "./RoutineBody";
import { DuolingoBody } from "./DuolingoBody";
import { SpiritualityBody } from "./SpiritualityBody";
import { HobbyBody } from "./HobbyBody";

// Habit slug → its detail-sheet body. A slug with no entry gets a note-only
// sheet (the shell still renders the note + save).
export const SHEET_BODIES: Record<string, ComponentType<SheetBodyProps>> = {
  treino: WorkoutBody,
  leitura: ReadingBody,
  sono: SleepBody,
  rotina: RoutineBody,
  duolingo: DuolingoBody,
  espiritualidade: SpiritualityBody,
  hobby: HobbyBody,
};
