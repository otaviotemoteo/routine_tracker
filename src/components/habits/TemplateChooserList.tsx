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
import type { ActivityWithHabit } from "@/db/habits";

interface TemplateChooserListProps {
  activities: ActivityWithHabit[];
  lang: Lang;
  copy: Copy["templates"];
  todayCopy: Copy["today"];
  // Which activity ?activity=<id> asked to open, if any — see page.tsx's
  // own comment on why this route is activity-addressed the same way
  // /config?activity= is.
  initialActivityId: number | null;
  // Carried through so the URL this list keeps in sync with doesn't drop
  // where "Concluir" is supposed to go back to.
  from?: string;
}

function activityUrl(id: number | null, from: string | undefined): string {
  const params = new URLSearchParams();
  if (id !== null) params.set("activity", String(id));
  if (from) params.set("from", from);
  const query = params.toString();
  return `/habits/templates${query ? `?${query}` : ""}`;
}

// The chooser's one interactive surface: a list of activities, each an
// accordion — closed shows a one-line status, open reveals the five
// template options with real previews. Modelled on ListCard's "collapse
// what's finished, tap to expand" shape (src/components/onboarding/ListCard),
// but the open body is a set of choices rather than a form, so it's a
// sibling rather than a reuse.
//
// Only one activity is open at a time: opening a second closes the first,
// same as the onboarding preview board's accordion — five previews per
// activity is already a lot on a 360px screen, and two at once would be a
// wall. The URL tracks whichever one that is (history.replaceState, no real
// navigation — same idiom AssessmentGrid uses) so a link straight into one
// activity's chooser, or a reload while one is open, both land in the right
// place.
export function TemplateChooserList({
  activities,
  lang,
  copy,
  todayCopy,
  initialActivityId,
  from,
}: TemplateChooserListProps) {
  const [openId, setOpenId] = useState<number | null>(
    activities.some((a) => a.id === initialActivityId) ? initialActivityId : null
  );
  // The card someone tapped but hasn't saved yet — cleared whenever a
  // different activity opens (or this one closes), since only one activity is
  // open at a time and its staged pick shouldn't survive past that.
  const [stagedKind, setStagedKind] = useState<GenericTemplateKind | null>(null);

  function toggleOpen(id: number) {
    const next = openId === id ? null : id;
    setOpenId(next);
    setStagedKind(null);
    window.history.replaceState(null, "", activityUrl(next, from));
  }

  return (
    <ul className="flex flex-col gap-2.5 list-none">
      {activities.map((activity) => {
        const open = openId === activity.id;
        const chosenKind = isGenericTemplateKind(activity.templateKind)
          ? activity.templateKind
          : null;
        const suggestedKind = suggestedGenericTemplateKind(activity.metricType);
        const Icon = habitIcon(activity.templateKind, activity.domainSlug);
        const name = habitName(lang, activity.slug, activity.name);

        const status = chosenKind
          ? format(copy.statusChosen, { name: copy.names[chosenKind] })
          : format(copy.statusSuggested, { name: copy.names[suggestedKind] });

        // One background class, not two layered — same-specificity Tailwind
        // utilities resolve by generated-CSS order, not by position in this
        // string, so conditionally appending a second bg-* class on top of
        // the first is not reliable. White at rest (open or closed — the
        // same white either way), light green once finished. Used to be
        // bg-cream at rest, which blends into the page's own background
        // (body is bg-cream too) and read as unfinished forever rather than
        // as "not yet touched, still there".
        const rowBg = chosenKind ? "bg-mint" : "bg-white";

        return (
          <li
            key={activity.id}
            className={`rounded-card border-2 border-forest shadow-hard overflow-hidden ${rowBg}`}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggleOpen(activity.id)}
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
              // One column below sm: two-up only has room once a card isn't
              // forced thin to fit — a phone-width screen split in half
              // left each option too narrow for its own preview.
              <div className="px-4 pb-4 border-t-2 border-dashed border-sand pt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GENERIC_TEMPLATE_KINDS.map((kind: GenericTemplateKind) => (
                  // Checklist alone spans both columns at sm+ — its editing
                  // state grows a textarea that a squarish half-width cell
                  // can't hold; the other four sit two-up there, closer to a
                  // real card's own squarish shape than a full-width strip.
                  <div
                    key={kind}
                    className={kind === "checklist" ? "sm:col-span-2" : undefined}
                  >
                    <TemplateOption
                      activity={activity}
                      kind={kind}
                      chosen={chosenKind === kind}
                      suggested={!chosenKind && suggestedKind === kind}
                      staged={stagedKind === kind}
                      onStage={() => setStagedKind(kind)}
                      onSaved={() => {
                        setOpenId(null);
                        setStagedKind(null);
                        window.history.replaceState(null, "", activityUrl(null, from));
                      }}
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
