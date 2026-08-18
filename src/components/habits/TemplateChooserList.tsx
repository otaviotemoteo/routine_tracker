"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { TemplateOption } from "@/components/habits/TemplateOption";
import { habitIcon } from "@/lib/icons";
import { format, habitName, type Copy, type Lang } from "@/lib/i18n";
import {
  GENERIC_TEMPLATE_KINDS,
  isGenericTemplateKind,
  suggestedGenericTemplateKind,
  type GenericTemplateKind,
} from "@/lib/templates";
import type { HabitRow } from "@/db/habits";

interface TemplateChooserListProps {
  habits: HabitRow[];
  lang: Lang;
  copy: Copy["templates"];
  todayCopy: Copy["today"];
}

// The chooser's one interactive surface: a list of habits, each an
// accordion — closed shows a one-line status, open reveals the five
// template options with real previews. Modelled on ListCard's "collapse
// what's finished, tap to expand" shape (src/components/onboarding/ListCard),
// but the open body is a set of choices rather than a form, so it's a
// sibling rather than a reuse.
//
// Only one habit is open at a time: opening a second closes the first, same
// as the onboarding preview board's accordion — five previews per habit is
// already a lot on a 360px screen, and two at once would be a wall.
export function TemplateChooserList({
  habits,
  lang,
  copy,
  todayCopy,
}: TemplateChooserListProps) {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <ul className="flex flex-col gap-2.5 list-none">
      {habits.map((habit) => {
        const open = openId === habit.id;
        const chosenKind = isGenericTemplateKind(habit.templateKind)
          ? habit.templateKind
          : null;
        const suggestedKind = suggestedGenericTemplateKind(habit.metricType);
        const Icon = habitIcon(habit.templateKind, habit.domainSlug);
        const name = habitName(lang, habit.slug, habit.name);

        const status = chosenKind
          ? format(copy.statusChosen, { name: copy.names[chosenKind] })
          : format(copy.statusSuggested, { name: copy.names[suggestedKind] });

        // One background class, not two layered — same-specificity Tailwind
        // utilities resolve by generated-CSS order, not by position in this
        // string, so conditionally appending a second bg-* class on top of
        // the first is not reliable.
        const rowBg = open ? "bg-white" : chosenKind ? "bg-mint" : "bg-cream";

        return (
          <li
            key={habit.id}
            className={`rounded-card border-2 border-forest shadow-hard overflow-hidden ${rowBg}`}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : habit.id)}
              className="w-full min-h-[64px] text-left px-4 py-3 flex items-start gap-3"
            >
              <Icon
                aria-hidden
                className={`w-[18px] h-[18px] mt-0.5 shrink-0 ${
                  chosenKind ? "text-clover" : "text-straw"
                }`}
              />
              <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                <span className="font-bold text-sm">{name}</span>
                <span
                  className={`text-xs font-semibold ${
                    chosenKind ? "text-clover" : "text-straw"
                  }`}
                >
                  {status}
                </span>
              </span>
              <ChevronRight
                aria-hidden
                className={`w-4 h-4 shrink-0 mt-1.5 opacity-50 transition-transform duration-150 ${
                  open ? "rotate-90" : ""
                }`}
              />
            </button>

            {open && (
              <div className="px-4 pb-4 border-t-2 border-dashed border-sand pt-3.5 grid grid-cols-2 gap-3">
                {GENERIC_TEMPLATE_KINDS.map((kind: GenericTemplateKind) => (
                  // Checklist alone spans both columns — its editing state
                  // grows a textarea that a squarish half-width cell can't
                  // hold; the other four sit two-up, closer to a real card's
                  // own squarish shape than the old full-width strip.
                  <div
                    key={kind}
                    className={kind === "checklist" ? "col-span-2" : undefined}
                  >
                    <TemplateOption
                      habit={habit}
                      kind={kind}
                      chosen={chosenKind === kind}
                      suggested={!chosenKind && suggestedKind === kind}
                      copy={copy}
                      todayCopy={todayCopy}
                    />
                  </div>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
