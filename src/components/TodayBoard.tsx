import Link from "next/link";
import { ListChecks } from "lucide-react";
import { HabitCard } from "@/components/HabitCard";
import type { Copy, Lang } from "@/lib/i18n";
import type { CheckWithHabit, TodayContext } from "@/types/habit";

interface TodayBoardProps {
  checks: CheckWithHabit[];
  context: TodayContext;
  title: string;
  lang: Lang;
  copy: Copy["today"];
  dailyCopy: Copy["daily"];
}

// Today is a status board: progress, one card per habit reporting where it
// stands, and a single call to action that opens the guided flow. No controls
// on the cards, so the whole screen is server-rendered.
export function TodayBoard({
  checks,
  context,
  title,
  lang,
  copy,
  dailyCopy,
}: TodayBoardProps) {
  const required = checks.filter((c) => !c.optional);
  const doneCount = required.filter((c) => c.done).length;
  const percent =
    required.length === 0 ? 0 : Math.round((doneCount / required.length) * 100);
  const allDone = required.length > 0 && doneCount === required.length;

  return (
    <>
      <h1 className="display-title text-4xl sm:text-5xl mt-2 mb-7">{title}</h1>

      <div className="flex flex-col gap-5">
        <section
          aria-label={copy.progressAria}
          className="bg-white border-2 border-forest rounded-card shadow-hard px-5 py-4"
        >
          <div className="flex justify-between items-baseline font-semibold mb-2.5">
            <span>{allDone ? copy.dayComplete : copy.progress}</span>
            <span className="font-mono font-bold text-sm">
              {doneCount}/{required.length} · {percent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={required.length}
            aria-label={copy.progressAria}
            className="h-4 border-2 border-forest rounded-full bg-sand overflow-hidden"
          >
            <div
              className={`h-full bg-clover transition-[width] duration-300 ${
                percent > 0 && percent < 100 ? "border-r-2 border-forest" : ""
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          {!allDone && (
            <p className="text-sm opacity-75 mt-2.5">{copy.fillHint}</p>
          )}
        </section>

        <Link
          href="/day"
          className="min-h-[52px] inline-flex items-center justify-center gap-2 px-7 rounded-full border-2 border-forest bg-clover text-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm"
        >
          <ListChecks aria-hidden className="w-5 h-5" />
          {dailyCopy.start}
        </Link>

        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4 list-none">
          {checks.map((check) => (
            <li key={check.id} className="contents">
              <HabitCard
                check={check}
                context={context}
                lang={lang}
                copy={copy}
              />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
