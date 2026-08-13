import { exerciseScheme } from "@/lib/exercise";
import { format, locale, type Copy, type Lang } from "@/lib/i18n";
import { templateKindOf } from "@/lib/templates";
import { relativeDay } from "@/lib/utils";
import type { TodayComparisons } from "@/db/queries";
import type { CheckWithHabit, TodayContext } from "@/types/habit";

// Everything a Today card shows, in one shape for all seven habits: one big
// number that carries the point, a tinted panel that stretches to fill whatever
// height is left, and a note pinned under it. The panel is what absorbs the
// slack — a card must never pad itself with empty space.

export type CardState = "done" | "pending" | "extra";

// A habit made of parts (exercises, blocks, languages, practices) shows them
// as a checklist rather than a comma-separated line: the panel has the room,
// and "which ones" is the question the card is being asked.
export interface PanelItem {
  label: string;
  // Omitted for rows that are figures rather than things to tick off — a
  // check mark next to "Time this week" would claim it was completed.
  done?: boolean;
  detail?: string; // "3×12", "07:00", "2×"
  // How much this row got over the trailing week. Drawn as a bar scaled to the
  // largest row, so the list doubles as a small chart.
  bar?: number;
}

// A single proportion — how far through the book, how much of the plan.
export interface PanelMeter {
  value: number;
  max: number;
  caption: string;
}

// One column per night. Single series, so no legend: the caption names it.
export interface PanelBars {
  caption: string;
  max: number;
  // A recessive hairline across the plot — the night you were aiming for.
  target?: number;
  targetLabel?: string;
  columns: { label: string; value: number; valueLabel: string }[];
}

export interface TodayCard {
  state: CardState;
  hero: { value: string; unit: string };
  panel: {
    label: string;
    text?: string;
    meter?: PanelMeter;
    bars?: PanelBars;
    itemsLabel?: string;
    items?: PanelItem[];
    // "list" is a row per item; "grid" is a tile per item, two across — for a
    // short set of equals where the rows would leave the panel half empty.
    itemsLayout?: "list" | "grid";
    // How many rows this panel can hold before it needs a "+N more". Set where
    // the panel is built, since it depends on what else is in there.
    maxItems?: number;
    // Two or three figures, shown large — the answer when there is no list and
    // no proportion, only numbers.
    stats?: { label: string; value: string }[];
  } | null;
  note: { primary: string; secondary?: string } | null;
}

// Reading needs figures the card can't derive on its own (they depend on the
// whole book list and the days left in the year).
export interface ReadingPace {
  perDay: number;
  forecast?: string; // already formatted date
}

function rec(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

// How long the configured window actually is, crossing midnight.
function targetWindowHours(bedtime: string, wakeTime: string): number {
  const minutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };
  const span = minutes(wakeTime) - minutes(bedtime);
  return (span <= 0 ? span + 24 * 60 : span) / 60;
}

// One letter under each column of the sleep plot.
function weekdayInitial(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: "UTC",
    weekday: "narrow",
  })
    .format(new Date(`${date}T12:00:00Z`))
    .toUpperCase();
}

// "6h40" — the shape sleep figures take everywhere on this screen.
function hoursLabel(hours: number): string {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return minutes === 0
    ? `${whole}h`
    : `${whole}h${String(minutes).padStart(2, "0")}`;
}

export function buildTodayCard(
  check: CheckWithHabit,
  context: TodayContext,
  copy: Copy["today"],
  lang: Lang,
  today: string,
  comparisons: TodayComparisons,
  pace?: ReadingPace
): TodayCard {
  const d = rec(check.details);
  const state: CardState = check.done
    ? check.optional
      ? "extra"
      : "done"
    : "pending";

  const ago = relativeDay(comparisons.lastDone[check.slug], today, {
    today: copy.agoToday,
    yesterday: copy.agoYesterday,
    daysAgo: copy.agoDays,
    never: copy.agoNever,
  });
  // A one-day "streak" is just today — only a real run is worth a line.
  const streak = comparisons.streak[check.slug] ?? 0;
  const streakLine = streak >= 2 ? streak : null;
  const panelLabel = check.done ? copy.panelLogged : copy.panelPlanned;

  // Dispatch on the TEMPLATE KIND, not the slug. For the seven migrated
  // habits the two are identical, so every case below is reached exactly as
  // before; for anything created since, the kind is null and the generic
  // renderer at the bottom takes it.
  switch (templateKindOf(check.templateKind)) {
    case "treino": {
      // What was logged wins over what was scheduled — you may have trained
      // another day's session, or trained at all on a rest day.
      const loggedDay =
        typeof d?.plan_day_id === "number"
          ? (context.plan?.days.find((x) => x.id === d.plan_day_id) ?? null)
          : null;
      const day = loggedDay ?? context.plan?.day ?? null;
      const completed = Array.isArray(d?.completed) ? d!.completed : [];
      const done = completed.filter((e) => rec(e)?.done === true).length;
      const planned = day?.exercises.length ?? completed.length;
      const sets = (day?.exercises ?? []).reduce(
        (sum, e) => sum + (e.sets ?? 0),
        0
      );
      return {
        state,
        hero: {
          value: planned ? `${done}/${planned}` : String(done),
          unit: copy.unitExercises,
        },
        panel: day
          ? {
              label: panelLabel,
              text:
                sets > 0
                  ? format(copy.ctxSets, { focus: day.focus, sets })
                  : day.focus,
              // The plan's exercises, ticked off against what was logged.
              items: day.exercises.map((exercise) => ({
                label: exercise.name,
                done: completed.some(
                  (e) => rec(e)?.name === exercise.name && rec(e)?.done === true
                ),
                detail: exerciseScheme(exercise) || undefined,
              })),
            }
          : {
              label: panelLabel,
              text: context.plan ? copy.noteNoTraining : copy.ctxNoPlan,
            },
        note: check.done
          ? typeof d?.effort === "number"
            ? {
                primary: format(copy.noteEffort, { value: d.effort }),
                secondary: streakLine
                  ? format(copy.noteStreakDays, { n: streakLine })
                  : undefined,
              }
            : streakLine
              ? { primary: format(copy.noteStreakDays, { n: streakLine }) }
              : null
          : { primary: format(copy.noteLastWorkout, { ago }) },
      };
    }

    case "leitura": {
      const book = context.book;
      const pages = typeof d?.pages_read === "number" ? d.pages_read : 0;
      const page =
        typeof d?.ended_on_page === "number"
          ? d.ended_on_page
          : (book?.currentPage ?? 0);
      // Pending, the panel says where today's reading should land rather than
      // restating where the bookmark already is.
      const target =
        !check.done && book && pace
          ? format(copy.ctxReadTo, {
              title: book.title,
              n: pace.perDay,
              page: page + pace.perDay,
            })
          : book
            ? format(copy.ctxBookPage, {
                title: book.title,
                page,
                total: book.totalPages,
              })
            : copy.ctxNoBook;
      return {
        state,
        hero: { value: String(pages), unit: copy.unitPagesToday },
        panel: book
          ? {
              label: panelLabel,
              text: target,
              meter: {
                value: page,
                max: book.totalPages,
                caption: `${page} / ${book.totalPages}`,
              },
              // The road ahead, so the card shows a plan rather than a page.
              itemsLabel: book.queue.length ? copy.nextBooks : undefined,
              items: book.queue.length
                ? book.queue.map((next) => ({
                    label: next.title,
                    detail: format(copy.pagesShort, { n: next.totalPages }),
                  }))
                : undefined,
              // The text and the meter already take most of the panel — two
              // books plus a "+N more" is what's left before it clips.
              maxItems: 2,
            }
          : { label: panelLabel, text: copy.ctxNoBook },
        note: pace
          ? {
              primary: format(copy.notePace, { n: pace.perDay }),
              secondary: check.done
                ? pace.forecast
                  ? format(copy.noteForecast, { date: pace.forecast })
                  : undefined
                : format(copy.noteLastRead, { ago }),
            }
          : null,
      };
    }

    case "sono": {
      const hours = typeof d?.hours === "number" ? d.hours : null;
      const target = context.sleepTarget;
      const targetHours = target
        ? targetWindowHours(target.bedtime, target.wakeTime)
        : null;
      // Today's own night joins the plot, so the card compares it to the week.
      const nights = [
        ...comparisons.recentSleep,
        ...(hours !== null ? [{ date: today, hours }] : []),
      ].slice(-7);
      const weekAvg =
        comparisons.avgSleepHours === null
          ? undefined
          : format(copy.noteWeekAvgSleep, {
              value: hoursLabel(comparisons.avgSleepHours),
            });
      return {
        state,
        hero: {
          value: hours !== null ? hoursLabel(hours) : "—",
          unit: copy.unitSlept,
        },
        // Always the target: the app stores how long you slept, not when you
        // went to bed, so "logged 23:40 – 06:50" would be invented.
        panel: {
          label: copy.panelTarget,
          text: target
            ? format(copy.ctxSleepTarget, {
                from: target.bedtime,
                to: target.wakeTime,
              })
            : copy.ctxNothingSet,
          bars: nights.length
            ? {
                caption: copy.lastNights,
                max: Math.max(...nights.map((n) => n.hours), targetHours ?? 0, 1),
                target: targetHours ?? undefined,
                targetLabel: targetHours ? hoursLabel(targetHours) : undefined,
                columns: nights.map((night) => ({
                  label: weekdayInitial(night.date, lang),
                  value: night.hours,
                  valueLabel: hoursLabel(night.hours),
                })),
              }
            : undefined,
        },
        note: check.done
          ? {
              primary:
                typeof d?.quality === "number"
                  ? format(copy.noteQuality, { value: d.quality })
                  : d?.woke_up_at_night
                    ? copy.noteWokeUp
                    : copy.noteSleptThrough,
              secondary: weekAvg,
            }
          : {
              primary: copy.noteLogOnWaking,
              secondary: weekAvg,
            },
      };
    }

    case "rotina": {
      const followed = Array.isArray(d?.followed_block_ids)
        ? d!.followed_block_ids.length
        : 0;
      const total = context.routineBlocks.length;
      const hardest =
        typeof d?.struggled_block_id === "number"
          ? context.routineBlocks.find((b) => b.id === d.struggled_block_id)
          : undefined;
      const avgBlocks =
        comparisons.avgRoutineBlocks === null || total === 0
          ? null
          : format(copy.noteAvgBlocks, {
              done: Math.round(comparisons.avgRoutineBlocks),
              total,
            });
      return {
        state,
        hero: {
          value: total ? `${followed}/${total}` : String(followed),
          unit: copy.unitBlocks,
        },
        panel: total
          ? {
              label: panelLabel,
              items: context.routineBlocks.map((block) => ({
                label: block.activity,
                done: Array.isArray(d?.followed_block_ids)
                  ? d!.followed_block_ids.includes(block.id)
                  : false,
                detail: block.startTime,
              })),
              // Nothing else in this panel, so a full day of blocks fits.
              maxItems: 6,
            }
          : { label: panelLabel, text: copy.ctxNothingSet },
        note: check.done
          ? hardest
            ? {
                primary: format(copy.noteHardest, { block: hardest.activity }),
                secondary:
                  typeof d?.struggle_note === "string" && d.struggle_note
                    ? format(copy.noteStruggle, { note: d.struggle_note })
                    : (avgBlocks ?? undefined),
              }
            : avgBlocks
              ? { primary: avgBlocks }
              : null
          : avgBlocks
            ? { primary: avgBlocks }
            : { primary: format(copy.noteLastTime, { ago }) },
      };
    }

    case "duolingo": {
      const sessions = Array.isArray(d?.sessions) ? d!.sessions.map(rec) : [];
      const practiced = sessions.filter(
        (s) => typeof s?.lessons === "number" && s.lessons > 0
      );
      const totalLessons = practiced.reduce<number>(
        (sum, s) => sum + (typeof s?.lessons === "number" ? s.lessons : 0),
        0
      );
      // "1 lesson in each" only reads true when every one got the same count.
      const uniform =
        practiced.length > 1 &&
        practiced.every((s) => s?.lessons === practiced[0]?.lessons);
      return {
        state,
        hero: {
          value: String(practiced.length),
          unit: copy.unitLanguages,
        },
        panel: context.languages.length
          ? {
              label: panelLabel,
              // A tile per language: a handful of equals, which as rows would
              // leave most of the panel empty.
              itemsLayout: "grid",
              items: context.languages.map((language) => {
                const lessons = sessions.find(
                  (s) => s?.language_slug === language.slug
                )?.lessons;
                const count = typeof lessons === "number" ? lessons : 0;
                const week = comparisons.weekLessons[language.slug] ?? 0;
                return {
                  label: language.name,
                  done: count > 0,
                  detail: count > 0 ? `${count}×` : undefined,
                  bar: week,
                };
              }),
              itemsLabel: format(copy.weekLessonsLabel, {
                n: Object.values(comparisons.weekLessons).reduce(
                  (sum, n) => sum + n,
                  0
                ),
              }),
            }
          : { label: panelLabel, text: copy.ctxNothingSet },
        note: check.done
          ? totalLessons
            ? {
                primary: uniform
                  ? format(copy.noteLessonsEach, {
                      n: Number(practiced[0]?.lessons ?? 0),
                    })
                  : format(copy.noteLessonsTotal, { n: totalLessons }),
                secondary: streakLine
                  ? format(copy.noteStreakKept, { n: streakLine })
                  : undefined,
              }
            : streakLine
              ? { primary: format(copy.noteStreakKept, { n: streakLine }) }
              : null
          : streakLine
            ? { primary: format(copy.noteStreakAtRisk, { n: streakLine }) }
            : { primary: format(copy.noteLastTime, { ago }) },
      };
    }

    case "espiritualidade": {
      const done = Array.isArray(d?.practices) ? d!.practices.map(rec) : [];
      const names = done
        .map(
          (p) =>
            context.practices.find((x) => x.slug === String(p?.slug))?.name
        )
        .filter(Boolean)
        .join(", ");
      return {
        state,
        hero: {
          value: String(done.length),
          unit: format(copy.unitOfPractices, { total: context.practices.length }),
        },
        panel: context.practices.length
          ? {
              label: panelLabel,
              itemsLayout: "grid",
              items: context.practices.map((practice) => {
                const logged = done.find((p) => String(p?.slug) === practice.slug);
                const count = logged && typeof logged.count === "number"
                  ? logged.count
                  : undefined;
                return {
                  label: practice.name,
                  done: Boolean(logged),
                  detail: count ? `${count}×` : undefined,
                  bar: comparisons.weekPractices[practice.slug] ?? 0,
                };
              }),
              itemsLabel: copy.weekPracticesLabel,
            }
          : { label: panelLabel, text: copy.ctxNothingSet },
        note: check.done
          ? names
            ? {
                primary: format(copy.notePracticesDone, { names }),
                secondary: streakLine
                  ? format(copy.noteStreakDays, { n: streakLine })
                  : undefined,
              }
            : null
          : { primary: format(copy.noteLastTime, { ago }) },
      };
    }

    case "hobby": {
      const minutes = typeof d?.minutes === "number" ? d.minutes : 0;
      const activity =
        typeof d?.activity === "string" && d.activity ? d.activity : null;
      return {
        state,
        hero: {
          value: String(minutes),
          unit: activity
            ? format(copy.unitMinutesOf, { activity })
            : copy.unitMinutes,
        },
        // Hobby has nothing configured to plan against, so its panel reports
        // the week instead of restating the optional rule twice.
        panel: {
          label: copy.panelOptional,
          text: copy.noteOptionalSub,
          // No list and no proportion here — just two figures, so show them as
          // figures rather than as two thin rows.
          itemsLabel: copy.thisWeek,
          stats: [
            {
              label: copy.hobbyWeekSessions,
              value: String(comparisons.hobbySessions + (check.done ? 1 : 0)),
            },
            {
              label: copy.hobbyWeekMinutes,
              value: `${comparisons.hobbyMinutes + minutes}`,
            },
          ],
        },
        note: check.done
          ? streakLine
            ? { primary: format(copy.noteStreakDays, { n: streakLine }) }
            : null
          : { primary: format(copy.noteLastTime, { ago }) },
      };
    }

    // Every habit that isn't one of the original seven — which, after the
    // remodel, is every habit anyone creates.
    //
    // The seven cards above each know something about their area: which
    // session today's plan holds, which page the book is on, what the sleep
    // window is. This one knows none of that, and inventing a substitute
    // would break "never show a number the data can't support". What it has
    // instead is the habit's own metric, its target and its minimal action —
    // which is enough for a real card rather than a bare tick.
    default:
      return plainCard(check, copy, state, panelLabel, streakLine, ago);
  }
}

// The generic renderer.
//
// Kept to the same anatomy as the seven (hero · panel · note) because a grid
// where one card is shaped differently reads as a broken card, not a simpler
// one — and because sibling cards have to match in height, which is the
// panel's job via `flex-1`.
function plainCard(
  check: CheckWithHabit,
  copy: Copy["today"],
  state: CardState,
  panelLabel: string,
  streakLine: number | null,
  ago: string
): TodayCard {
  const d = rec(check.details);
  const logged = typeof d?.value === "number" ? d.value : null;
  const target = check.target;

  // What the big number says, per metric. A binary habit genuinely has no
  // number, and printing "1" for it would be a figure the reader has to
  // decode into a yes — so it says the word instead.
  const hero =
    check.metricType === "binary"
      ? {
          value: check.done ? "✓" : "—",
          unit: check.done ? copy.plainDone : copy.plainPending,
        }
      : {
          value: String(logged ?? 0),
          unit:
            check.unit ??
            (check.metricType === "duration"
              ? copy.plainUnitMinutes
              : copy.plainUnitCount),
        };

  // The panel's eyebrow states the MODE, not the metric: LOGGED once there is
  // a figure, TARGET when there is one to aim at, PLANNED otherwise.
  const label =
    check.done && logged !== null
      ? copy.panelLogged
      : target !== null
        ? copy.panelTarget
        : panelLabel;

  // A meter only when there is a real proportion to draw. With no target
  // there is no "how far through" to show, and a bar filled against an
  // invented maximum would be exactly the number the data can't support.
  const meter =
    target !== null && target > 0 && check.metricType !== "binary"
      ? {
          value: Math.min(logged ?? 0, target),
          max: target,
          caption: format(copy.plainOfTarget, {
            value: logged ?? 0,
            target,
            unit: check.unit ?? "",
          }).trim(),
        }
      : undefined;

  // A pending card still has content: the minimal action is the most useful
  // thing this habit can say on a day it hasn't been done, because it is
  // the version that still counts when the day has gone badly.
  const text =
    check.minimalAction !== null
      ? format(copy.ctxMinimal, { action: check.minimalAction })
      : target !== null
        ? format(copy.ctxTarget, { n: target, unit: check.unit ?? "" }).trim()
        : copy.ctxNoTarget;

  return {
    state,
    hero,
    panel: { label, text, meter },
    // The one comparison line the card is allowed. Days only, never a clock
    // time — the record is São Paulo calendar days, so "3 days ago" is as
    // precise as this may honestly get.
    note: check.done
      ? streakLine
        ? { primary: format(copy.noteStreakDays, { n: streakLine }) }
        : null
      : { primary: format(copy.noteLastTime, { ago }) },
  };
}

// "12 de outubro" — when the current book runs out at the required pace.
export function forecastFinishDate(
  pagesLeft: number,
  perDay: number,
  lang: Lang
): string | undefined {
  if (pagesLeft <= 0 || perDay <= 0) return undefined;
  const days = Math.ceil(pagesLeft / perDay);
  const finish = new Date();
  finish.setUTCHours(12, 0, 0, 0);
  finish.setUTCDate(finish.getUTCDate() + days);
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(finish);
}
