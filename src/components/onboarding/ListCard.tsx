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
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${toggleLabel}: ${title}`}
          onClick={onToggle}
          className="flex-1 min-w-0 min-h-[56px] px-4 py-3 text-left"
        >
          <span className="block font-semibold truncate">{title}</span>
          {detail && !open && (
            <span className="block text-xs opacity-70 truncate">{detail}</span>
          )}
        </button>

        {/* Edit sits next to the chevron rather than under the content: the two
            things you can do to an entry belong together, at its edge. */}
        {open && !editing && (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 min-h-[44px] inline-flex items-center gap-1.5 px-3 rounded-full border-2 border-forest bg-mint font-semibold text-xs"
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden />
            {editLabel}
          </button>
        )}

        {/* A second handle on the same action: the title button is the one
            keyboard and screen readers use, this is just the visible chevron. */}
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={onToggle}
          className="shrink-0 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
        >
          <ChevronRight
            className={`w-5 h-5 transition-transform duration-150 ${
              open ? "rotate-90" : ""
            }`}
          />
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t-2 border-dashed border-sand pt-3">
          {editing ? children : read}
        </div>
      )}
    </div>
  );
}
