// Churn auditing for the new-user first run — the whole of it.
//
// The chain a friend walks is:
//
//   values check-in (12 areas) → results → directions (one per priority area)
//   → the areas review → the habits screen → Today
//
// Every one of those steps already saves on advance, so "where they stopped"
// is derivable from the rows they left behind. The only thing the database
// could not answer was whether a run had stopped at all.
//
// So: one nullable column, users.first_run_step. It is written on each
// advance and set back to NULL when the run completes. That means any
// non-null value IS an abandonment — a finished run leaves nothing behind —
// and the entire churn signal is one query:
//
//   SELECT first_run_step, count(*) FROM users
//    WHERE first_run_step IS NOT NULL GROUP BY 1;
//
// Deliberately NOT a per-step column tracking every stage, and not a runs
// table. Both would record the happy path, which nobody needs.

import { DOMAIN_SLUGS, type DomainSlug } from "./domains";

// The step vocabulary. Stored as a string rather than an enum column because
// two of the five are parameterised by area, and a CHECK constraint listing
// thirty values would need a migration every time the domain list moved.
export type FirstRunStep =
  | `assessment:${DomainSlug}`
  | "results"
  | `directions:${DomainSlug}`
  | "areas"
  | "habits";

export function assessmentStep(slug: DomainSlug): FirstRunStep {
  return `assessment:${slug}`;
}

export function directionStep(slug: DomainSlug): FirstRunStep {
  return `directions:${slug}`;
}

// Every step in the order they are walked — for reading the column back, so a
// report can sort by how far someone got rather than alphabetically.
export const FIRST_RUN_STEPS: FirstRunStep[] = [
  ...DOMAIN_SLUGS.map(assessmentStep),
  "results",
  ...DOMAIN_SLUGS.map(directionStep),
  "areas",
  "habits",
];

// How far through the run a stored value is, 0-based. -1 for a value written
// by a version of the app that named its steps differently, which is worth
// keeping visible rather than silently bucketing as "step 0".
export function firstRunProgress(step: string | null): number {
  if (step === null) return -1;
  return FIRST_RUN_STEPS.indexOf(step as FirstRunStep);
}
