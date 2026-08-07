// The diagnostic engine: reads a filled values grid and names the patterns in
// it. Pure arithmetic, no I/O, no AI — the whole point is that the numbers are
// calculated here and can be trusted, so that anything written *about* them
// later never has to do the maths itself.
//
// On severity: it is a MAGNITUDE within a pattern, not a ranking across
// patterns. A LIVING_GAP at 0.7 is not "worse" than an AUTOPILOT at 0.5 — they
// measure different distances. No copy may claim one finding is your worst
// problem, because this file cannot know that.

import {
  DOMAIN_SLUGS,
  domainPosition,
  SCALE_MAX,
  SCALE_MIN,
  type DomainSlug,
} from "./domains";

// One domain's six answers.
export interface Rating {
  possibility: number;
  importanceNow: number;
  importanceGeneral: number;
  action: number;
  actionSatisfaction: number;
  concern: number;
}

// A grid. Partial because a draft is legally incomplete: every function here
// simply skips domains that aren't answered yet.
export type DomainRatings = Partial<Record<DomainSlug, Rating>>;

export type Pattern =
  | "LIVING_GAP" // matters a lot, barely acted on
  | "EMPTY_ACTION" // acted on a lot, satisfies little
  | "HOPELESSNESS" // matters a lot, feels impossible
  | "ANXIETY_NO_ACTION" // worried a lot, acted little
  | "POSTPONED" // matters in general, not right now
  | "AUTOPILOT" // acted on a lot, matters little
  | "BLIND_SPOT"; // nothing registers at all

export interface Finding {
  // Slug, never the database id — that's what keeps this module (and its
  // tests) free of anything that had to come out of Postgres.
  domainSlug: DomainSlug;
  pattern: Pattern;
  // 0–1. The normalised distance between the two columns that fired it.
  severity: number;
  // Only the columns that fired, so the UI can show its work.
  evidence: Partial<Rating>;
}

// Calibration lives here, in one place, and nowhere else. Deliberately NOT a
// settings screen: a system whose job is to show you a gap should not let you
// tune the gap away, and building a screen to configure the configurator is
// how a personal tool turns into a product.
export const THRESHOLDS = {
  high: 8,
  low: 4,
  gap: 4,
} as const;

// The widest a 1–10 pair can be apart, used to normalise severity.
const SPAN = SCALE_MAX - SCALE_MIN;

// Below this, the gaps between domains are too close together for the cut at
// five to mean much, and the results screen says so out loud.
export const NARROW_SPREAD = 1;

// ─── Derived metrics ─────────────────────────────────────────────────────────

export interface DerivedMetrics {
  // The main signal: what you say matters, minus what you did.
  valueActionGap: number;
  // Matters, but feels out of reach.
  hopeGap: number;
  // Worry that isn't turning into action.
  anxietyLoad: number;
  // Negative means the effort isn't landing: either the bar is too high or
  // it's the wrong effort.
  alignment: number;
}

// Note there is no `misallocation` (action − importanceGeneral): it is exactly
// −valueActionGap, and two named numbers that always sum to zero eventually
// get rendered side by side looking like they disagree. Read the sign instead.
export function derivedMetrics(r: Rating): DerivedMetrics {
  return {
    valueActionGap: r.importanceGeneral - r.action,
    hopeGap: r.importanceGeneral - r.possibility,
    anxietyLoad: r.concern - r.action,
    alignment: r.actionSatisfaction - r.action,
  };
}

// ─── Pattern detection ───────────────────────────────────────────────────────

function normalise(distance: number): number {
  // Clamped because a pattern can only fire on a positive distance, and a
  // severity above 1 would be a bug in a rule rather than a stronger signal.
  return Math.min(1, Math.max(0, distance / SPAN));
}

function findingsFor(slug: DomainSlug, r: Rating): Finding[] {
  const { high, low, gap } = THRESHOLDS;
  const out: Finding[] = [];

  const add = (
    pattern: Pattern,
    severity: number,
    evidence: Partial<Rating>
  ) => {
    out.push({ domainSlug: slug, pattern, severity, evidence });
  };

  if (r.importanceGeneral >= high && r.action <= low) {
    add("LIVING_GAP", normalise(r.importanceGeneral - r.action), {
      importanceGeneral: r.importanceGeneral,
      action: r.action,
    });
  }

  if (r.action >= high && r.actionSatisfaction <= low) {
    add("EMPTY_ACTION", normalise(r.action - r.actionSatisfaction), {
      action: r.action,
      actionSatisfaction: r.actionSatisfaction,
    });
  }

  if (r.importanceGeneral >= high && r.possibility <= low) {
    add("HOPELESSNESS", normalise(r.importanceGeneral - r.possibility), {
      importanceGeneral: r.importanceGeneral,
      possibility: r.possibility,
    });
  }

  if (r.concern >= high && r.action <= low) {
    add("ANXIETY_NO_ACTION", normalise(r.concern - r.action), {
      concern: r.concern,
      action: r.action,
    });
  }

  if (r.importanceGeneral - r.importanceNow >= gap) {
    add("POSTPONED", normalise(r.importanceGeneral - r.importanceNow), {
      importanceGeneral: r.importanceGeneral,
      importanceNow: r.importanceNow,
    });
  }

  if (r.action >= high && r.importanceGeneral <= low) {
    add("AUTOPILOT", normalise(r.action - r.importanceGeneral), {
      action: r.action,
      importanceGeneral: r.importanceGeneral,
    });
  }

  // No pair fires this one, so it normalises inside its own logic: how far
  // below the "low" line the highest answer sits.
  const highest = Math.max(
    r.possibility,
    r.importanceNow,
    r.importanceGeneral,
    r.action,
    r.actionSatisfaction,
    r.concern
  );
  if (highest <= low) {
    const severity = Math.min(1, (low - highest) / (low - SCALE_MIN));
    add("BLIND_SPOT", severity, { ...r });
  }

  return out;
}

// A domain firing several patterns is the feature, not a bug: HOPELESSNESS and
// ANXIETY_NO_ACTION together say something neither says alone. Returned in
// domain order, then by severity, so the caller gets a stable list.
export function diagnose(ratings: DomainRatings): Finding[] {
  const out: Finding[] = [];
  for (const slug of DOMAIN_SLUGS) {
    const rating = ratings[slug];
    if (rating) out.push(...findingsFor(slug, rating));
  }
  return out.sort(
    (a, b) =>
      domainPosition(a.domainSlug) - domainPosition(b.domainSlug) ||
      b.severity - a.severity ||
      a.pattern.localeCompare(b.pattern)
  );
}

// ─── Prioritisation ──────────────────────────────────────────────────────────

// Hard cut. Not configurable, because an excited first cycle would set it to
// eight and then nothing would get done. Five goals is already ambitious.
export const PRIORITY_CUT = 5;

export interface DomainGap {
  domainSlug: DomainSlug;
  gap: number;
  importanceGeneral: number;
  action: number;
}

// Every rated domain with its value-action gap, worst first. This single
// ordering drives the whole results screen: the chart is these rows, and the
// priority list is a prefix of it.
export function rankByGap(ratings: DomainRatings): DomainGap[] {
  const rows: DomainGap[] = [];
  for (const slug of DOMAIN_SLUGS) {
    const r = ratings[slug];
    if (!r) continue;
    rows.push({
      domainSlug: slug,
      gap: r.importanceGeneral - r.action,
      importanceGeneral: r.importanceGeneral,
      action: r.action,
    });
  }
  return rows.sort(
    (a, b) =>
      b.gap - a.gap ||
      b.importanceGeneral - a.importanceGeneral ||
      // Domain order last, so the sort is a TOTAL order: two identical rows
      // must not be able to swap places between two calls, or the priority cut
      // would drift for no reason.
      domainPosition(a.domainSlug) - domainPosition(b.domainSlug)
  );
}

// The domains to work on this cycle.
//
// Ranked by the RAW gap, not by a z-score. Standardising within one assessment
// cannot change this ordering — subtracting a column's mean is a constant
// across all twelve domains, and dividing the gap by its own deviation is
// monotone. What z-scoring the two columns separately WOULD do is weight them
// differently: importance answers cluster (most people answer 7–10), so its
// deviation is small, 1/sd is large, and the ranking quietly stops being about
// action at all. Z-scores earn their place in gapSpread() below instead.
//
// The eligibility floor is what keeps "I don't care about this and I don't do
// it" out of the list — a real gap needs something worth closing.
export function prioritize(ratings: DomainRatings): DomainSlug[] {
  return rankByGap(ratings)
    .filter((row) => row.importanceGeneral > THRESHOLDS.low)
    .slice(0, PRIORITY_CUT)
    .map((row) => row.domainSlug);
  // Never padded to five. Padding pushes a domain you rated a 3 into
  // goal-setting, which is how this turns into a machine for feeling bad.
}

// How spread out the gaps are, as a standard deviation. Small means the
// domains are bunched and the cut at five is somewhat arbitrary — which the
// results screen should admit rather than present a false ranking. Null when
// there isn't enough answered to say anything.
export function gapSpread(ratings: DomainRatings): number | null {
  const gaps = rankByGap(ratings).map((row) => row.gap);
  if (gaps.length < 2) return null;
  const mean = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
  const variance =
    gaps.reduce((sum, g) => sum + (g - mean) ** 2, 0) / gaps.length;
  return Math.sqrt(variance);
}
