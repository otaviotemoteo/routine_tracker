"use client";

import { Pencil } from "lucide-react";

interface CollapsedCardProps {
  title: string;
  detail?: string;
  editLabel: string;
  onEdit: () => void;
}

// A filled-in row, folded away: mint background says "done", and the whole
// card is the edit affordance. Keeps long lists (training days, books, routine
// blocks) short while you build the next one.
export function CollapsedCard({
  title,
  detail,
  editLabel,
  onEdit,
}: CollapsedCardProps) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="w-full min-h-[56px] flex items-center justify-between gap-3 px-4 py-3 rounded-card border-2 border-forest bg-mint shadow-hard text-left transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm"
    >
      <span className="min-w-0">
        <span className="block font-semibold truncate">{title}</span>
        {detail && (
          <span className="block text-xs opacity-70 truncate">{detail}</span>
        )}
      </span>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold shrink-0">
        <Pencil className="w-4 h-4" aria-hidden />
        {editLabel}
      </span>
    </button>
  );
}
