import { describe, expect, test } from "bun:test";
import {
  diagnose,
  derivedMetrics,
  gapSpread,
  prioritize,
  rankByGap,
  THRESHOLDS,
  type DomainRatings,
  type Pattern,
  type Rating,
} from "./diagnose";
import { DOMAIN_SLUGS, type DomainSlug } from "./domains";

// A grid that fires nothing: every scale sits between the thresholds. Each
// test perturbs one domain away from it, so a finding can only come from the
// columns that test is about.
const NEUTRAL: Rating = {
  possibility: 6,
  importanceNow: 6,
  importanceGeneral: 6,
  action: 6,
  actionSatisfaction: 6,
  concern: 6,
};

const rating = (patch: Partial<Rating> = {}): Rating => ({ ...NEUTRAL, ...patch });

// One domain rated, the rest absent — enough for diagnose(), which skips
// unanswered domains.
const only = (slug: DomainSlug, patch: Partial<Rating>): DomainRatings => ({
  [slug]: rating(patch),
});

// All twelve rated, so prioritize() and gapSpread() see a full grid.
const grid = (patches: Partial<Record<DomainSlug, Partial<Rating>>>): DomainRatings =>
  Object.fromEntries(
    DOMAIN_SLUGS.map((slug) => [slug, rating(patches[slug])])
  ) as DomainRatings;

const patterns = (ratings: DomainRatings): Pattern[] =>
  diagnose(ratings).map((f) => f.pattern);

describe("the neutral grid", () => {
  test("fires nothing", () => {
    expect(diagnose(grid({}))).toEqual([]);
  });
});

describe("each pattern fires at its threshold and not one step past it", () => {
  test("LIVING_GAP: matters a lot, barely acted on", () => {
    expect(
      patterns(only("work", { importanceGeneral: 8, importanceNow: 8, action: 4 }))
    ).toEqual(["LIVING_GAP"]);
    // One step out on either column and it goes quiet.
    expect(
      patterns(only("work", { importanceGeneral: 8, importanceNow: 8, action: 5 }))
    ).toEqual([]);
    expect(
      patterns(only("work", { importanceGeneral: 7, importanceNow: 7, action: 4 }))
    ).toEqual([]);
  });

  test("EMPTY_ACTION: plenty of action, little satisfaction", () => {
    expect(patterns(only("work", { action: 8, actionSatisfaction: 4 }))).toEqual([
      "EMPTY_ACTION",
    ]);
    expect(patterns(only("work", { action: 8, actionSatisfaction: 5 }))).toEqual([]);
    expect(patterns(only("work", { action: 7, actionSatisfaction: 4 }))).toEqual([]);
  });

  test("HOPELESSNESS: matters a lot, feels closed", () => {
    expect(
      patterns(
        only("health", { importanceGeneral: 9, importanceNow: 9, possibility: 3 })
      )
    ).toEqual(["HOPELESSNESS"]);
    expect(
      patterns(
        only("health", { importanceGeneral: 9, importanceNow: 9, possibility: 5 })
      )
    ).toEqual([]);
  });

  test("ANXIETY_NO_ACTION: worried a lot, acting little", () => {
    expect(patterns(only("health", { concern: 9, action: 3 }))).toEqual([
      "ANXIETY_NO_ACTION",
    ]);
    expect(patterns(only("health", { concern: 9, action: 5 }))).toEqual([]);
    expect(patterns(only("health", { concern: 7, action: 3 }))).toEqual([]);
  });

  test("POSTPONED: matters in general, parked for now", () => {
    // The gap threshold is 4, so exactly 4 fires and 3 does not.
    expect(
      patterns(only("art", { importanceGeneral: 9, importanceNow: 5 }))
    ).toEqual(["POSTPONED"]);
    expect(
      patterns(only("art", { importanceGeneral: 9, importanceNow: 6 }))
    ).toEqual([]);
  });

  test("AUTOPILOT: acting a lot on something that matters little", () => {
    expect(
      patterns(
        only("work", { action: 9, importanceGeneral: 3, importanceNow: 3 })
      )
    ).toEqual(["AUTOPILOT"]);
    expect(
      patterns(
        only("work", { action: 9, importanceGeneral: 5, importanceNow: 5 })
      )
    ).toEqual([]);
  });

  test("BLIND_SPOT: every answer is low", () => {
    const allThree: Partial<Rating> = {
      possibility: 3,
      importanceNow: 3,
      importanceGeneral: 3,
      action: 3,
      actionSatisfaction: 3,
      concern: 3,
    };
    expect(patterns(only("community", allThree))).toEqual(["BLIND_SPOT"]);
    // A single answer above the line is enough for the domain to register.
    expect(patterns(only("community", { ...allThree, concern: 5 }))).toEqual([]);
  });
});

describe("severity", () => {
  test("is the normalised distance between the two columns that fired", () => {
    const [finding] = diagnose(
      only("work", { importanceGeneral: 10, importanceNow: 10, action: 1 })
    );
    // The widest a 1–10 pair can be apart.
    expect(finding.severity).toBe(1);

    const [smaller] = diagnose(
      only("work", { importanceGeneral: 8, importanceNow: 8, action: 4 })
    );
    expect(smaller.severity).toBeCloseTo(4 / 9, 10);
  });

  test("carries only the columns that fired as evidence", () => {
    const [finding] = diagnose(only("work", { action: 8, actionSatisfaction: 2 }));
    expect(finding.evidence).toEqual({ action: 8, actionSatisfaction: 2 });
  });
});

describe("a domain can fire several patterns at once", () => {
  test("hopeless and anxious and not acting is three findings, not one", () => {
    const found = diagnose(
      only("health", {
        importanceGeneral: 9,
        importanceNow: 9,
        possibility: 2,
        concern: 9,
        action: 2,
      })
    );
    expect(found.map((f) => f.pattern).sort()).toEqual([
      "ANXIETY_NO_ACTION",
      "HOPELESSNESS",
      "LIVING_GAP",
    ]);
    expect(new Set(found.map((f) => f.domainSlug))).toEqual(new Set(["health"]));
  });
});

describe("derivedMetrics", () => {
  test("reads the four independent distances", () => {
    expect(
      derivedMetrics(
        rating({
          importanceGeneral: 9,
          action: 2,
          possibility: 4,
          concern: 8,
          actionSatisfaction: 1,
        })
      )
    ).toEqual({
      valueActionGap: 7,
      hopeGap: 5,
      anxietyLoad: 6,
      alignment: -1,
    });
  });
});

describe("prioritize", () => {
  test("ranks by the raw value-action gap, worst first", () => {
    const result = prioritize(
      grid({
        family: { importanceGeneral: 10, action: 1 }, // gap 9
        work: { importanceGeneral: 9, action: 5 }, // gap 4
        health: { importanceGeneral: 8, action: 2 }, // gap 6
      })
    );
    expect(result.slice(0, 3)).toEqual(["family", "health", "work"]);
  });

  test("a big gap in a domain that doesn't matter never outranks a small one that does", () => {
    // family's gap is 3 but its importance sits ON the floor, so it is not
    // eligible; work's gap is only 1 but it clears the floor.
    const result = prioritize(
      grid({
        family: { importanceGeneral: THRESHOLDS.low, action: 1 },
        work: { importanceGeneral: 5, action: 4 },
        ...Object.fromEntries(
          DOMAIN_SLUGS.filter((s) => s !== "family" && s !== "work").map((s) => [
            s,
            { importanceGeneral: 3, action: 3 },
          ])
        ),
      })
    );
    expect(result).toEqual(["work"]);
    expect(result).not.toContain("family");
  });

  test("returns fewer than five rather than padding the list", () => {
    const result = prioritize(
      grid({
        ...Object.fromEntries(
          DOMAIN_SLUGS.map((s) => [s, { importanceGeneral: 2, action: 1 }])
        ),
        family: { importanceGeneral: 9, action: 1 },
        work: { importanceGeneral: 8, action: 2 },
      })
    );
    expect(result).toEqual(["family", "work"]);
  });

  test("cuts at five even when everything is eligible", () => {
    expect(prioritize(grid({}))).toHaveLength(5);
  });

  test("is a total order: identical rows keep domain order, every time", () => {
    // Every domain has the same gap, importance and concern, so only the
    // position tie-break can decide — and it must decide the same way twice.
    const flat = grid({});
    const first = prioritize(flat);
    for (let i = 0; i < 100; i++) {
      expect(prioritize(flat)).toEqual(first);
    }
    expect(first).toEqual(DOMAIN_SLUGS.slice(0, 5));
  });

  test("is a prefix of the gap chart, so the results screen has one ordering", () => {
    const ratings = grid({
      family: { importanceGeneral: 10, action: 1 },
      health: { importanceGeneral: 9, action: 3 },
      work: { importanceGeneral: 8, action: 4 },
    });
    const eligible = rankByGap(ratings)
      .filter((row) => row.importanceGeneral > THRESHOLDS.low)
      .map((row) => row.domainSlug);
    expect(prioritize(ratings)).toEqual(eligible.slice(0, 5));
  });
});

describe("gapSpread", () => {
  test("is zero when every gap is identical", () => {
    expect(gapSpread(grid({}))).toBe(0);
  });

  test("is null when there isn't enough answered to say anything", () => {
    expect(gapSpread({})).toBeNull();
    expect(gapSpread(only("work", {}))).toBeNull();
  });

  test("grows as the domains spread apart", () => {
    const bunched = gapSpread(
      grid({ family: { importanceGeneral: 7, action: 6 } })
    );
    const spread = gapSpread(
      grid({ family: { importanceGeneral: 10, action: 1 } })
    );
    expect(spread).toBeGreaterThan(bunched!);
  });
});

describe("draft grids", () => {
  test("unanswered domains are skipped, not treated as zeroes", () => {
    const partial: DomainRatings = {
      family: rating({ importanceGeneral: 9, action: 1 }),
      work: rating(),
    };
    expect(rankByGap(partial).map((r) => r.domainSlug)).toEqual(["family", "work"]);
    expect(diagnose(partial).every((f) => f.domainSlug === "family")).toBe(true);
  });
});
