import { Check, Clock } from "lucide-react";
import { PaceInfo } from "@/components/PaceInfo";
import { PanelChart } from "@/components/today/PanelChart";
import { habitIcon } from "@/lib/icons";
import { format, habitName, type Copy, type Lang } from "@/lib/i18n";
import { buildTodayCard, type ReadingPace } from "@/lib/today-card";
import type { PaceValues } from "@/lib/setup-summary";
import type { TodayComparisons } from "@/db/queries";
import type { CheckWithHabit, TodayContext } from "@/types/habit";

// What fits in the panel of a 320px card alongside a label, a line of text and
// the note.
const MAX_PANEL_ITEMS = 5;

interface HabitCardProps {
  check: CheckWithHabit;
  context: TodayContext;
  lang: Lang;
  copy: Copy["today"];
  readingCopy: Copy["onboarding"]["reading"];
  today: string;
  comparisons: TodayComparisons;
  // Reading only: the target and the numbers behind it.
  pace?: ReadingPace;
  paceValues?: PaceValues;
}

// One anatomy for every habit — status pill, a hero number, a context panel and
// a note. The panel is the flexible band: it stretches to the note, so a card
// with little to say is still full rather than half empty. Read-only; all
// logging happens in the guided flow.
export function HabitCard({
  check,
  context,
  lang,
  copy,
  readingCopy,
  today,
  comparisons,
  pace,
  paceValues,
}: HabitCardProps) {
  const Icon = habitIcon(check.templateKind, check.domainSlug);
  const name = habitName(lang, check.slug, check.name);
  const card = buildTodayCard(
    check,
    context,
    copy,
    lang,
    today,
    comparisons,
    pace
  );
  const pending = card.state === "pending";
  // Row bars are scaled to the busiest row, so the list reads as a comparison
  // between its own items rather than against an invented ceiling.
  const allItems = card.panel?.items ?? [];
  const barMax = Math.max(0, ...allItems.map((item) => item.bar ?? 0));
  // The card is a fixed frame. Show what fits and say how much didn't, rather
  // than letting one long list set the height of every card on the board.
  const items = allItems.slice(0, card.panel?.maxItems ?? MAX_PANEL_ITEMS);
  const hiddenItems = allItems.length - items.length;
  const grid = card.panel?.itemsLayout === "grid";

  const pill = {
    done: { label: copy.pillDone, className: "text-clover bg-mint" },
    extra: { label: copy.pillExtra, className: "text-clover bg-mint" },
    pending: { label: copy.pillPending, className: "text-straw bg-straw/15" },
  }[card.state];

  return (
    <div
      className={`h-full overflow-hidden flex flex-col gap-2.5 p-4 rounded-card border-2 border-forest shadow-hard ${
        check.optional ? "border-dashed" : ""
      } ${pending ? "bg-cream" : "bg-white"}`}
    >
      {/* The habit's name wraps rather than truncates; break-words is the
          backstop for a long single word in a narrow column. */}
      <div className="flex items-start gap-2">
        <Icon
          aria-hidden
          className={`w-4 h-4 shrink-0 mt-0.5 ${
            pending ? "text-straw" : "text-clover"
          }`}
        />
        <span className="font-semibold text-sm flex-1 min-w-0 leading-tight break-words">
          {name}
        </span>
        <span
          className={`shrink-0 inline-flex items-center gap-1 text-[0.62rem] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${pill.className}`}
        >
          {pending ? (
            <Clock className="w-3 h-3" strokeWidth={3} aria-hidden />
          ) : (
            <Check className="w-3 h-3" strokeWidth={3.5} aria-hidden />
          )}
          {pill.label}
        </span>
      </div>

      {/* The number carries the point; the unit tells you what it counts. */}
      <p className="flex items-baseline gap-1.5">
        <span className="font-mono font-bold text-2xl leading-none">
          {card.hero.value}
        </span>
        <span className="text-sm font-semibold opacity-60">
          {card.hero.unit}
        </span>
      </p>

      {card.panel && (
        // flex-1 makes this the band that absorbs the grid's shared height.
        <div
          className={`flex-1 min-h-0 rounded-lg px-3 py-2.5 flex flex-col gap-1.5 ${
            card.panel.items ? "justify-start" : "justify-center"
          } ${pending ? "bg-straw/15" : "bg-mint"}`}
        >
          <span
            className={`font-mono text-[0.58rem] font-bold uppercase tracking-widest ${
              pending ? "text-straw" : "text-clover/70"
            }`}
          >
            {card.panel.label}
          </span>
          {card.panel.text && (
            <span
              className={`text-xs font-semibold leading-snug line-clamp-2 ${
                pending ? "text-forest/80" : "text-forest"
              }`}
            >
              {card.panel.text}
            </span>
          )}
          {card.panel.meter && (
            // Caption beside the bar, not under it — a line saved is a book
            // that still fits in the queue below.
            <div className="flex items-center gap-2">
              <div
                role="progressbar"
                aria-valuenow={card.panel.meter.value}
                aria-valuemin={0}
                aria-valuemax={card.panel.meter.max}
                aria-label={card.panel.meter.caption}
                className="flex-1 h-2 rounded-full bg-forest/10 overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-clover"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (card.panel.meter.value / card.panel.meter.max) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
              <span className="shrink-0 font-mono text-[0.62rem] font-bold opacity-55">
                {card.panel.meter.caption}
              </span>
            </div>
          )}

          {card.panel.bars && <PanelChart bars={card.panel.bars} />}

          {card.panel.itemsLabel && (
            <span
              className={`font-mono text-[0.55rem] font-bold uppercase tracking-widest mt-1 ${
                pending ? "text-straw/80" : "text-clover/60"
              }`}
            >
              {card.panel.itemsLabel}
            </span>
          )}

          {card.panel.stats && (
            // Same tiles as the grid layout, carrying figures instead of a
            // check — so the four cards without a list still rhyme.
            <div className="grid grid-cols-2 gap-1.5 flex-1 content-start">
              {card.panel.stats.map((stat) => (
                <div
                  key={stat.label}
                  className={`rounded-lg px-2.5 py-2 ${
                    pending ? "bg-straw/15" : "bg-forest/[0.06]"
                  }`}
                >
                  <p className="font-mono font-bold text-xl leading-none">
                    {stat.value}
                  </p>
                  <p className="text-[0.58rem] font-semibold uppercase tracking-wider opacity-50 mt-1.5 leading-tight">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && grid && (
            // A tile per item, two across — the odd one out spans the row so
            // the grid never ends on a hole.
            <ul className="grid grid-cols-2 gap-1.5 list-none min-h-0 flex-1 content-start">
              {items.map((item, i) => (
                <li
                  key={item.label}
                  className={`rounded-lg px-2.5 py-2 flex flex-col gap-1.5 ${
                    i === items.length - 1 && items.length % 2 === 1
                      ? "col-span-2"
                      : ""
                  } ${
                    item.done
                      ? "bg-clover/15"
                      : pending
                        ? "bg-straw/15"
                        : "bg-forest/[0.06]"
                  }`}
                >
                  <span
                    className={`text-[0.7rem] font-semibold leading-tight truncate ${
                      item.done ? "" : "opacity-60"
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {item.done ? (
                      <Check
                        className="w-3.5 h-3.5 shrink-0 text-clover"
                        strokeWidth={3.5}
                        aria-hidden
                      />
                    ) : (
                      <Clock
                        className="w-3.5 h-3.5 shrink-0 text-straw"
                        strokeWidth={3}
                        aria-hidden
                      />
                    )}
                    {item.detail && (
                      <span className="font-mono text-[0.65rem] font-bold opacity-50">
                        {item.detail}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {items.length > 0 && !grid && (
            <ul className="flex flex-col gap-1 list-none min-h-0">
              {items.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-1.5 text-[0.7rem] leading-tight"
                >
                  {item.done === undefined ? null : item.done ? (
                    <Check
                      className="w-3 h-3 shrink-0 text-clover"
                      strokeWidth={3.5}
                      aria-hidden
                    />
                  ) : (
                    <span
                      aria-hidden
                      className={`w-3 h-3 shrink-0 rounded-[3px] border-2 ${
                        pending ? "border-straw/50" : "border-forest/20"
                      }`}
                    />
                  )}
                  <span
                    className={`flex-1 min-w-0 truncate font-medium ${
                      item.done ? "" : "opacity-55"
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.bar !== undefined && barMax > 0 && (
                    <span
                      aria-hidden
                      className="shrink-0 w-10 h-1.5 rounded-full bg-forest/10 overflow-hidden"
                    >
                      <span
                        className="block h-full rounded-full bg-clover"
                        style={{
                          width: `${Math.round((item.bar / barMax) * 100)}%`,
                        }}
                      />
                    </span>
                  )}
                  {item.detail && (
                    <span className="shrink-0 min-w-6 whitespace-nowrap text-right font-mono text-[0.65rem] opacity-50">
                      {item.detail}
                    </span>
                  )}
                </li>
              ))}
              {hiddenItems > 0 && (
                <li className="text-[0.65rem] font-semibold opacity-45 pl-[1.125rem]">
                  {format(copy.moreItems, { n: hiddenItems })}
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {card.note && (
        <div
          className={`rounded-lg px-3 py-2 flex items-center gap-2 ${
            pending ? "bg-straw/10" : "bg-cream"
          }`}
        >
          <span className="flex-1 min-w-0">
            <span className="block text-xs font-bold leading-snug">
              {card.note.primary}
            </span>
            {card.note.secondary && (
              <span
                className={`block text-[0.7rem] font-medium leading-snug mt-0.5 ${
                  pending ? "text-straw" : "opacity-55"
                }`}
              >
                {card.note.secondary}
              </span>
            )}
          </span>
          {paceValues && <PaceInfo copy={readingCopy} values={paceValues} />}
        </div>
      )}
    </div>
  );
}
