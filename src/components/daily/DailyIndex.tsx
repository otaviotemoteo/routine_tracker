import Link from "next/link";
import { Check, ChevronRight, Clock } from "lucide-react";
import { cardStatus } from "@/lib/card-status";
import { dailyStepHref, type DailyStepSlug } from "@/lib/daily";
import { habitName, type Copy, type Lang } from "@/lib/i18n";
import { habitIcon } from "@/lib/icons";
import type { CheckWithHabit, TodayContext } from "@/types/habit";

interface DailyIndexProps {
  checks: CheckWithHabit[];
  context: TodayContext;
  lang: Lang;
  copy: Copy["daily"];
  todayCopy: Copy["today"];
}

// The day at a glance, one area per row: what's already logged (mint, with its
// summary) and what still needs filling (white). Shown when the day is
// partially done, so the user picks up where they left off instead of
// stepping through everything again.
export function DailyIndex({
  checks,
  context,
  lang,
  copy,
  todayCopy,
}: DailyIndexProps) {
  return (
    <ul className="flex flex-col gap-3 list-none">
      {checks.map((check) => {
        const Icon = habitIcon(check.slug);
        const status = cardStatus(check, context, todayCopy);
        const name = habitName(lang, check.slug, check.name);
        return (
          <li key={check.id}>
            <Link
              href={dailyStepHref(check.slug as DailyStepSlug)}
              className={`min-h-[64px] flex items-center gap-3 px-4 py-3 rounded-card border-2 border-forest shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm ${
                check.done ? "bg-mint" : "bg-white"
              } ${check.optional ? "border-dashed" : ""}`}
            >
              <span
                aria-hidden
                className={`w-[30px] h-[30px] shrink-0 rounded-lg border-2 border-forest flex items-center justify-center ${
                  check.done ? "bg-clover text-white" : "bg-straw/30"
                }`}
              >
                {check.done ? (
                  <Check className="w-5 h-5" strokeWidth={3.5} />
                ) : (
                  <Clock className="w-4 h-4 text-forest/75" strokeWidth={2.5} />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold">
                  <Icon aria-hidden className="w-4 h-4 text-clover shrink-0" />
                  {name}
                </span>
                <span
                  className={`block text-xs mt-0.5 leading-snug ${
                    check.done ? "text-clover font-semibold" : "opacity-70"
                  }`}
                >
                  {check.done ? status.detail : copy.pending}
                </span>
              </span>

              <span className="inline-flex items-center gap-1 text-sm font-semibold shrink-0">
                {check.done ? copy.edit : copy.fill}
                <ChevronRight className="w-4 h-4" aria-hidden />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
