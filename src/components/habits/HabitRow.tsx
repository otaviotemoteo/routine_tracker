"use client";

import { useRef } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { habitIcon } from "@/lib/icons";
import { format, type Copy } from "@/lib/i18n";
import { ghostButton, iconButton } from "@/components/ui/styles";
import type { ActivityWithHabit } from "@/db/habits";

interface HabitRowProps {
  habit: ActivityWithHabit;
  copy: Copy["habits"];
  editHref: string;
  removeAction: (formData: FormData) => void;
  next: string;
  // Suggestions are marked until touched — that marking is what makes
  // accept / edit / reject legible rather than implicit.
  showSource?: boolean;
  // Current run of done days. Omitted where the screen has no business
  // claiming one — see the comment on the figure below.
  streak?: number;
}

// One habit, as a compact row.
//
// It reports four things and offers two actions, in a single band rather than
// the stacked card this used to be. The density is the point: a list of habits
// is something you scan to find the one you want to change, and a screen where
// five habits meant five scrolls made you hunt.
//
// The row itself is not a link — a card wrapping two buttons would nest
// interactive elements — so Edit and Remove are explicit targets.
export function HabitRow({
  habit,
  copy,
  editHref,
  removeAction,
  next,
  showSource = false,
  streak,
}: HabitRowProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const Icon = habitIcon(habit.templateKind, habit.domainSlug);

  // The measure, as a chip. For a counted or timed habit the user's own unit
  // says more than the metric's name does ("PAGES" beats "COUNT"), so the unit
  // wins when there is one. It is user content and is never translated.
  const badge =
    habit.metricType === "binary"
      ? copy.badgeBinary
      : (habit.unit?.trim() || copy.badgeBinary).toUpperCase();

  const target =
    habit.target !== null
      ? format(copy.rowTarget, { n: habit.target, unit: habit.unit ?? "" }).trim()
      : copy.rowNoTarget;

  return (
    <li className="border-2 border-forest rounded-card bg-white shadow-hard">
      {/* Wraps at 360px instead of squeezing any target under 44px, which is
          why the row has a min-height rather than a fixed one. */}
      <div className="min-h-[72px] flex items-center gap-3 flex-wrap px-3 py-2.5">
        <span
          aria-hidden
          className="shrink-0 w-11 h-11 rounded-lg bg-mint flex items-center justify-center"
        >
          <Icon className="w-5 h-5 text-clover" />
        </span>

        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold break-words">{habit.name}</span>
            <span className="shrink-0 font-mono text-[10px] font-bold tracking-wider text-clover bg-mint px-2 py-0.5 rounded-full">
              {badge}
            </span>
            {/* A badge earns its place only when it says something: an
                untouched suggestion is worth calling out, an edited one is
                worth distinguishing, and a hand-written habit needs neither. */}
            {showSource && habit.source === "ai_suggested" && (
              <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border-2 border-forest bg-straw">
                {copy.suggested}
              </span>
            )}
            {showSource && habit.source === "ai_edited" && (
              <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border-2 border-forest bg-mint">
                {copy.edited}
              </span>
            )}
          </div>

          {/* Target and the bad-day version on one line. The minimal action is
              the half that gets truncated, because the target is short and
              bounded while this is free text. */}
          <p className="flex items-center gap-1.5 min-w-0 text-sm opacity-75">
            <span className="shrink-0">{target}</span>
            {habit.minimalAction && (
              <>
                <span aria-hidden className="shrink-0 opacity-40">
                  ·
                </span>
                <span className="min-w-0 truncate">
                  {format(copy.rowMinimal, { action: habit.minimalAction })}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2.5 ml-auto">
          {/* Never rendered for a habit with no run going. UX_PRINCIPLES:
              don't show a number the data can't support — a zero here would
              read as a verdict on somebody's week rather than as an absence
              of data. */}
          {streak !== undefined && streak > 0 && (
            <p className="text-right leading-none">
              <span className="block font-mono font-bold text-straw">
                {format(copy.streakValue, { n: streak })}
              </span>
              <span className="block text-[9px] font-bold tracking-wider opacity-50 mt-0.5">
                {copy.streakLabel}
              </span>
            </p>
          )}

          <div className="flex gap-1.5">
            <Link
              href={editHref}
              aria-label={`${copy.edit} ${habit.name}`}
              className={iconButton}
            >
              <Pencil className="w-4 h-4" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => dialogRef.current?.showModal()}
              aria-label={`${copy.remove} ${habit.name}`}
              className={iconButton}
            >
              <Trash2 className="w-4 h-4 text-[#a8452f]" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {/* The one-line reason a suggestion gave. Below the band rather than in
          it: it is the longest text on the row and would break the density
          everywhere else. */}
      {habit.why && (
        <p className="text-sm opacity-75 italic border-t-2 border-dashed border-sand px-3 py-2">
          {habit.why}
        </p>
      )}

      {/* Removing a tracked habit stops a record that may go back months, so
          it asks first. The safe choice is focused by default. */}
      <dialog
        ref={dialogRef}
        className="bg-transparent p-0 backdrop:bg-forest/40"
        aria-labelledby={`remove-${habit.id}`}
      >
        <div className="bg-white border-2 border-forest rounded-card shadow-hard p-6 w-[min(24rem,92vw)] text-forest">
          <h2 id={`remove-${habit.id}`} className="display-title text-xl">
            {format(copy.removeConfirm, { name: habit.name })}
          </h2>
          <div className="flex gap-2 flex-wrap justify-end mt-5">
            <button
              type="button"
              autoFocus
              onClick={() => dialogRef.current?.close()}
              className={ghostButton}
            >
              {copy.removeKeep}
            </button>
            <form action={removeAction}>
              <input type="hidden" name="id" value={habit.id} />
              <input type="hidden" name="next" value={next} />
              <button
                type="submit"
                className="min-h-[44px] inline-flex items-center justify-center px-5 rounded-full border-2 border-forest bg-forest text-cream font-semibold text-sm shadow-hard"
              >
                {copy.removeGo}
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </li>
  );
}
