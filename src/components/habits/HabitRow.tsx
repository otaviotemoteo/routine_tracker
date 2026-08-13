"use client";

import { useRef } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { habitIcon } from "@/lib/icons";
import { format, type Copy } from "@/lib/i18n";
import { ghostButton } from "@/components/ui/styles";
import type { HabitRow as HabitRowData } from "@/db/habits";

interface HabitRowProps {
  habit: HabitRowData;
  copy: Copy["habits"];
  editHref: string;
  removeAction: (formData: FormData) => void;
  next: string;
  // Suggestions are marked until touched — that marking is what makes
  // accept / edit / reject legible rather than implicit.
  showSource?: boolean;
}

// One habit, as a row. Reports what the habit is and offers exactly two ways
// out of reporting: Edit and Remove. The row itself is not a link, because a
// card wrapping two buttons would nest interactive elements.
export function HabitRow({
  habit,
  copy,
  editHref,
  removeAction,
  next,
  showSource = false,
}: HabitRowProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const Icon = habitIcon(habit.templateKind, habit.domainSlug);

  // How this habit is measured, as a phrase rather than a jargon word. The
  // unit is user content and is never translated.
  const metric =
    habit.metricType === "binary"
      ? copy.rowBinary
      : format(
          habit.metricType === "count" ? copy.rowCount : copy.rowDuration,
          { unit: habit.unit ?? "—" }
        );

  return (
    <li className="border-2 border-forest rounded-card bg-white shadow-hard p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="shrink-0 w-10 h-10 rounded-full border-2 border-forest bg-mint flex items-center justify-center"
        >
          <Icon className="w-5 h-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="font-semibold text-lg min-w-0 break-words">
              {habit.name}
            </h3>
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

          <p className="text-sm opacity-75 mt-0.5">
            {metric}
            {habit.target !== null && (
              <>
                {" · "}
                {format(copy.rowTarget, {
                  n: habit.target,
                  unit: habit.unit ?? "",
                }).trim()}
              </>
            )}
          </p>

          {habit.minimalAction && (
            <p className="text-sm mt-2 bg-mint border-2 border-forest rounded-lg px-3 py-1.5">
              {habit.minimalAction}
            </p>
          )}

          {/* The one-line reason a suggestion gave. Kept visible after an edit
              too — it is why the habit is on the list at all. */}
          {habit.why && (
            <p className="text-sm opacity-75 mt-2 italic">{habit.why}</p>
          )}
        </div>
      </div>

      {/* Wrapping at 360px rather than shrinking below the touch target. */}
      <div className="flex gap-2 flex-wrap mt-3 justify-end">
        <Link href={editHref} className={ghostButton}>
          <Pencil className="w-4 h-4 mr-1.5" aria-hidden />
          {copy.edit}
        </Link>
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className={ghostButton}
        >
          <Trash2 className="w-4 h-4 mr-1.5" aria-hidden />
          {copy.remove}
        </button>
      </div>

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
