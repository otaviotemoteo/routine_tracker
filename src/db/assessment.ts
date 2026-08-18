// Data access for the values layer. Sibling of queries.ts, same two rules:
// every function takes `userId` first, and every id-addressed write filters on
// the user too, so a foreign id matches no row rather than being mutated.
//
// The neon-http driver has no interactive transactions, so anything that needs
// a guard gets it as a predicate inside a single statement rather than as a
// read-then-write. Every such statement is commented where it appears.
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "./index";
import {
  assessmentRatings,
  assessments,
  cycles,
  directionNarratives,
  lifeDomains,
} from "./schema";
import type { UserId } from "./scope";
import { prioritize, type DomainRatings, type Rating } from "@/lib/diagnose";
import { DOMAIN_SLUGS, type DomainSlug } from "@/lib/domains";

export interface CycleRow {
  id: number;
  label: string;
  startsAt: string;
  endsAt: string;
}

export interface DraftAssessment {
  id: number;
  cycleId: number;
  takenAt: string;
  ratings: DomainRatings;
}

export interface SealedAssessment {
  id: number;
  cycleId: number;
  takenAt: string;
  completedAt: Date;
  priorityDomains: DomainSlug[];
  ratings: DomainRatings;
}

// ─── Domains ─────────────────────────────────────────────────────────────────

// slug → id, for turning the app's vocabulary into foreign keys. The table has
// twelve rows and never grows, so this is one trivially cached query.
export async function getDomainIds(): Promise<Record<DomainSlug, number>> {
  const rows = await db
    .select({ id: lifeDomains.id, slug: lifeDomains.slug })
    .from(lifeDomains)
    .orderBy(asc(lifeDomains.position));
  const out = {} as Record<DomainSlug, number>;
  for (const row of rows) out[row.slug as DomainSlug] = row.id;
  return out;
}

async function getDomainSlugs(): Promise<Record<number, DomainSlug>> {
  const ids = await getDomainIds();
  const out: Record<number, DomainSlug> = {};
  for (const slug of DOMAIN_SLUGS) {
    const id = ids[slug];
    if (id) out[id] = slug;
  }
  return out;
}

// ─── Cycles ──────────────────────────────────────────────────────────────────

// "2026-H2". Derived from the date, never chosen: a cycle is a half-year, and
// asking someone to name one would be a screen that decides nothing.
export function cycleLabel(date: string): string {
  const [year, month] = date.split("-").map(Number);
  return `${year}-H${month <= 6 ? 1 : 2}`;
}

export function cycleBounds(date: string): { startsAt: string; endsAt: string } {
  const [year, month] = date.split("-").map(Number);
  return month <= 6
    ? { startsAt: `${year}-01-01`, endsAt: `${year}-06-30` }
    : { startsAt: `${year}-07-01`, endsAt: `${year}-12-31` };
}

// `today` is passed in rather than read here: dates always come from
// todayInSaoPaulo() in app code, never from the database clock.
export async function getOrCreateCurrentCycle(
  userId: UserId,
  today: string
): Promise<CycleRow> {
  const label = cycleLabel(today);
  const { startsAt, endsAt } = cycleBounds(today);
  // Insert-or-ignore leaning on unique(user_id, label), so two concurrent
  // first loads can't produce two cycles.
  await db
    .insert(cycles)
    .values({ userId, label, startsAt, endsAt })
    .onConflictDoNothing();
  const [row] = await db
    .select({
      id: cycles.id,
      label: cycles.label,
      startsAt: cycles.startsAt,
      endsAt: cycles.endsAt,
    })
    .from(cycles)
    .where(and(eq(cycles.userId, userId), eq(cycles.label, label)))
    .limit(1);
  return row;
}

// ─── Ratings ─────────────────────────────────────────────────────────────────

async function ratingsFor(assessmentId: number): Promise<DomainRatings> {
  const slugs = await getDomainSlugs();
  const rows = await db
    .select()
    .from(assessmentRatings)
    .where(eq(assessmentRatings.assessmentId, assessmentId));
  const out: DomainRatings = {};
  for (const row of rows) {
    const slug = slugs[row.domainId];
    if (!slug) continue;
    out[slug] = {
      possibility: row.possibility,
      importanceNow: row.importanceNow,
      importanceGeneral: row.importanceGeneral,
      action: row.action,
      actionSatisfaction: row.actionSatisfaction,
      concern: row.concern,
    };
  }
  return out;
}

// ─── Drafts ──────────────────────────────────────────────────────────────────

// The assessment in progress, if there is one.
//
// DELIBERATELY reads nothing from any earlier assessment. Prefilling last
// cycle's answers would feel helpful and would quietly destroy the instrument:
// seeing that you said 7 last time anchors you at 7, and the grid stops
// measuring your life and starts measuring your memory of the last grid.
// Previous scores appear on the results screen, after the answers are in, and
// nowhere else.
export async function getOpenDraft(
  userId: UserId
): Promise<DraftAssessment | null> {
  const [row] = await db
    .select({
      id: assessments.id,
      cycleId: assessments.cycleId,
      takenAt: assessments.takenAt,
    })
    .from(assessments)
    .where(and(eq(assessments.userId, userId), isNull(assessments.completedAt)))
    .limit(1);
  if (!row) return null;
  return { ...row, ratings: await ratingsFor(row.id) };
}

export async function getOrCreateDraft(
  userId: UserId,
  cycleId: number,
  today: string
): Promise<DraftAssessment> {
  const existing = await getOpenDraft(userId);
  if (existing) return existing;
  // Leans on the partial unique index (one open draft per user), so a
  // double-tapped "start" produces one draft, not two.
  await db
    .insert(assessments)
    .values({ userId, cycleId, takenAt: today })
    .onConflictDoNothing();
  const draft = await getOpenDraft(userId);
  if (!draft) throw new Error("Could not open an assessment draft.");
  return draft;
}

// Write one domain's six answers.
//
// Ownership and the seal guard live in the same statement as the write: the
// row is only produced if the assessment exists, belongs to this user, and is
// still a draft. A read-then-write would be a race, and there are no
// interactive transactions to close it with.
export async function saveRating(
  userId: UserId,
  assessmentId: number,
  domainId: number,
  r: Rating
): Promise<boolean> {
  const result = await db.execute(sql`
    INSERT INTO assessment_ratings
      (assessment_id, domain_id, possibility, importance_now,
       importance_general, action, action_satisfaction, concern)
    SELECT ${assessmentId}, ${domainId}, ${r.possibility}, ${r.importanceNow},
           ${r.importanceGeneral}, ${r.action}, ${r.actionSatisfaction}, ${r.concern}
      FROM assessments a
     WHERE a.id = ${assessmentId}
       AND a.user_id = ${userId}
       AND a.completed_at IS NULL
    ON CONFLICT (assessment_id, domain_id) DO UPDATE SET
      possibility = EXCLUDED.possibility,
      importance_now = EXCLUDED.importance_now,
      importance_general = EXCLUDED.importance_general,
      action = EXCLUDED.action,
      action_satisfaction = EXCLUDED.action_satisfaction,
      concern = EXCLUDED.concern
    RETURNING id
  `);
  return (result.rows?.length ?? 0) > 0;
}

// Abandon a draft. Only ever deletes rows that were never sealed, so the
// append-only rule is untouched: a draft is not the record yet.
export async function discardDraft(
  userId: UserId,
  assessmentId: number
): Promise<void> {
  const owned = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(
      and(
        eq(assessments.id, assessmentId),
        eq(assessments.userId, userId),
        isNull(assessments.completedAt)
      )
    )
    .limit(1);
  if (!owned.length) return;
  await db
    .delete(assessmentRatings)
    .where(eq(assessmentRatings.assessmentId, assessmentId));
  await db.delete(assessments).where(eq(assessments.id, assessmentId));
}

// ─── Sealing ─────────────────────────────────────────────────────────────────

export type SealOutcome = "sealed" | "already-sealed" | "incomplete";

// Close an assessment forever and freeze its priority cut.
//
// The priorities are computed from the rows read back here, never from
// anything the client sent, and the UPDATE only fires when all twelve domains
// are present — so a partial grid can't be sealed and a half-empty
// priority_domains can't be written. A double-tapped Continue finds
// completed_at already set, returns no row, and is reported as
// "already-sealed" rather than as an error.
export async function sealAssessment(
  userId: UserId,
  assessmentId: number
): Promise<SealOutcome> {
  const ratings = await ratingsFor(assessmentId);
  if (Object.keys(ratings).length < DOMAIN_SLUGS.length) return "incomplete";
  const rows = await db
    .update(assessments)
    .set({ completedAt: new Date(), priorityDomains: prioritize(ratings) })
    .where(
      and(
        eq(assessments.id, assessmentId),
        eq(assessments.userId, userId),
        isNull(assessments.completedAt),
        sql`(SELECT count(*) FROM ${assessmentRatings}
              WHERE ${assessmentRatings.assessmentId} = ${assessmentId})
            = ${DOMAIN_SLUGS.length}`
      )
    )
    .returning({ id: assessments.id });
  return rows.length > 0 ? "sealed" : "already-sealed";
}

// ─── Reading a finished assessment ───────────────────────────────────────────

export async function getLatestSealed(
  userId: UserId
): Promise<SealedAssessment | null> {
  const [row] = await db
    .select({
      id: assessments.id,
      cycleId: assessments.cycleId,
      takenAt: assessments.takenAt,
      completedAt: assessments.completedAt,
      priorityDomains: assessments.priorityDomains,
    })
    .from(assessments)
    .where(
      and(
        eq(assessments.userId, userId),
        // Voided assessments were sealed in error. Kept, never read.
        isNull(assessments.voidedAt),
        sql`${assessments.completedAt} IS NOT NULL`
      )
    )
    .orderBy(sql`${assessments.takenAt} DESC, ${assessments.id} DESC`)
    .limit(1);
  if (!row || !row.completedAt) return null;
  return {
    id: row.id,
    cycleId: row.cycleId,
    takenAt: row.takenAt,
    completedAt: row.completedAt,
    priorityDomains: row.priorityDomains as DomainSlug[],
    ratings: await ratingsFor(row.id),
  };
}

// ─── Direction narratives ────────────────────────────────────────────────────

export interface NarrativeRow {
  // Insertion order — the only thing that can tell "written first" from
  // "written second" apart. See buildingAreas() in src/lib/assessment.ts,
  // which sorts a newly-added area by this rather than by domain taxonomy
  // order, so "Incluir outra área" appends where it was actually added.
  id: number;
  domainSlug: DomainSlug;
  rawReflection: string;
  narrative: string;
}

export async function listDirectionNarratives(
  userId: UserId,
  cycleId: number
): Promise<Record<string, NarrativeRow>> {
  const slugs = await getDomainSlugs();
  const rows = await db
    .select()
    .from(directionNarratives)
    .where(
      and(
        eq(directionNarratives.userId, userId),
        eq(directionNarratives.cycleId, cycleId)
      )
    );
  const out: Record<string, NarrativeRow> = {};
  for (const row of rows) {
    const slug = slugs[row.domainId];
    if (!slug) continue;
    out[slug] = {
      id: row.id,
      domainSlug: slug,
      rawReflection: row.rawReflection ?? "",
      narrative: row.narrative ?? "",
    };
  }
  return out;
}

export async function upsertDirectionNarrative(
  userId: UserId,
  cycleId: number,
  domainId: number,
  input: { rawReflection: string; narrative: string }
): Promise<void> {
  await db
    .insert(directionNarratives)
    .values({
      userId,
      cycleId,
      domainId,
      rawReflection: input.rawReflection || null,
      narrative: input.narrative || null,
      source: "human",
      acceptedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [directionNarratives.cycleId, directionNarratives.domainId],
      // The user filter belongs here too: without it a matching (cycle,
      // domain) pair would update regardless of who owns it.
      setWhere: eq(directionNarratives.userId, userId),
      set: {
        rawReflection: input.rawReflection || null,
        narrative: input.narrative || null,
        source: "human",
        acceptedAt: new Date(),
      },
    });
}
