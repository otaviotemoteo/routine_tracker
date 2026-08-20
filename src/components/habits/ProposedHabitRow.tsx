"use client";

import { useRef } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { habitIcon } from "@/lib/icons";
import { format, type Copy } from "@/lib/i18n";
import { ghostButton, iconButton } from "@/components/ui/styles";
import type { HabitRow as HabitRowData } from "@/db/habits";

interface ProposedHabitRowProps {
  habit: HabitRowData;
  copy: Copy["habits"];
  editHref: string;
  removeAction: (formData: FormData) => void;
  next: string;
  showSource?: boolean;
}

// A proposed HABIT — the umbrella, before "Start tracking" makes it and its
// default activity real. Deliberately its own, smaller component rather
// than HabitRow: at this stage there is no metric/target/minimal-action to
// show (that all lives on the activity now, and a proposed habit's default
// activity is itself still proposed, invisible everywhere but this screen's
// own review), so the row is just identity + why + edit/remove. See
// docs/ARCHITECTURE.md.
export function ProposedHabitRow({
  habit,
  copy,
  editHref,
  removeAction,
  next,
  showSource = false,
}: ProposedHabitRowProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const Icon = habitIcon(null, habit.domainSlug);

  return (
    <li className="border-2 border-forest rounded-card bg-white shadow-hard">
      <div className="min-h-[60px] flex items-center gap-3 flex-wrap px-3 py-2.5">
        <span
          aria-hidden
          className="shrink-0 w-11 h-11 rounded-lg bg-mint flex items-center justify-center"
        >
          <Icon className="w-5 h-5 text-clover" />
        </span>

        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold break-words">{habit.name}</span>
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
        </div>

        <div className="shrink-0 flex gap-1.5 ml-auto">
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

      {habit.why && (
        <p className="text-sm opacity-75 italic border-t-2 border-dashed border-sand px-3 py-2">
          {habit.why}
        </p>
      )}

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
