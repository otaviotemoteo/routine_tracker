"use client";

import { ChevronRight, Pencil } from "lucide-react";

interface ListCardProps {
  title: string;
  // Shown folded, as the one-line summary of what's inside.
  detail?: string;
  open: boolean;
  onToggle: () => void;
  toggleLabel: string;
  editing: boolean;
  onEdit: () => void;
  editLabel: string;
  // What the entry says when you're only looking at it.
  read: React.ReactNode;
  // The form, shown only after an explicit Edit.
  children: React.ReactNode;
}

// One entry in a list you're building (a training day, a book, a routine
// block), in three states: folded, open for reading, and editing.
//
// Opening and editing are deliberately separate. Arriving at a step you filled
// in weeks ago should let you *look* at it — dropping straight into a form
// invites changes nobody asked to make, and makes it unclear whether what you
// see is a record or a draft (UX_PRINCIPLES: "a screen either reports or
// edits").
export function ListCard({
  title,
  detail,
  open,
  onToggle,
  toggleLabel,
  editing,
  onEdit,
  editLabel,
  read,
  children,
}: ListCardProps) {
  return (
    <div
      className={`rounded-card border-2 border-forest shadow-hard ${
        open ? "bg-white" : "bg-mint"
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${toggleLabel}: ${title}`}
        onClick={onToggle}
        className="w-full min-h-[56px] flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block font-semibold truncate">{title}</span>
          {detail && !open && (
            <span className="block text-xs opacity-70 truncate">{detail}</span>
          )}
        </span>
        <ChevronRight
          aria-hidden
          className={`w-5 h-5 shrink-0 transition-transform duration-150 ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 border-t-2 border-dashed border-sand pt-3">
          {editing ? (
            children
          ) : (
            <>
              {read}
              <button
                type="button"
                onClick={onEdit}
                className="mt-3 min-h-[44px] inline-flex items-center gap-1.5 px-4 rounded-full border-2 border-forest bg-white font-semibold text-sm shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm"
              >
                <Pencil className="w-4 h-4" aria-hidden />
                {editLabel}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
