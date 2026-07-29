import { Check, Clock } from "lucide-react";
import { PaceInfo } from "@/components/PaceInfo";
import { habitIcon } from "@/lib/icons";
import { habitName, type Copy, type Lang } from "@/lib/i18n";
import { buildTodayCard, type ReadingPace } from "@/lib/today-card";
import type { PaceValues } from "@/lib/setup-summary";
import type { TodayComparisons } from "@/db/queries";
import type { CheckWithHabit, TodayContext } from "@/types/habit";

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
  const Icon = habitIcon(check.slug);
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

  const pill = {
    done: { label: copy.pillDone, className: "text-clover bg-mint" },
    extra: { label: copy.pillExtra, className: "text-clover bg-mint" },
    pending: { label: copy.pillPending, className: "text-straw bg-straw/15" },
  }[card.state];

  return (
    <div
      className={`h-full flex flex-col gap-2.5 p-4 rounded-card border-2 border-forest shadow-hard ${
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
              className={`text-xs font-semibold leading-snug ${
                pending ? "text-forest/80" : "text-forest"
              }`}
            >
              {card.panel.text}
            </span>
          )}
          {card.panel.items && (
            <ul className="flex flex-col gap-1 list-none mt-0.5">
              {card.panel.items.map((item) => (
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
                  {item.detail && (
                    <span className="shrink-0 font-mono text-[0.65rem] opacity-50">
                      {item.detail}
                    </span>
                  )}
                </li>
              ))}
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
