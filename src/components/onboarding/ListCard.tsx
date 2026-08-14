"use client";

import { useState } from "react";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";

export interface ListChip {
  text: string;
  // "count" is the primary figure of the row (green); "muted" is the second
  // one, which supports it. Two tones is the whole vocabulary — a third would
  // stop the eye from knowing which number to read first.
  tone?: "count" | "muted";
}

interface ListCardProps {
  title: string;
  // A short leading mark — the weekday of a training day, the position of a
  // book. Kept to three or four characters: it is an index, not a label.
  badge?: string;
  // Shown folded, as the one-line summary of what's inside.
  detail?: string;
  // Preferred over `detail` when the summary is really a set of counts.
  chips?: ListChip[];
  open: boolean;
  onToggle: () => void;
  toggleLabel: string;
  editing: boolean;
  onEdit: () => void;
  editLabel: string;
  // Removal. Omitted where an entry cannot be removed.
  onRemove?: () => void;
  removeLabel?: string;
  removeConfirm?: string; // {title} already interpolated by the caller
  removeWarning?: string;
  removeCancel?: string;
  removeGo?: string;
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
//
// Removal confirms INLINE, in a band that pushes the row open, rather than in
// a modal dialog. A dialog for "remove one of eight training days" throws the
// whole screen away to ask about one row, and you lose sight of the thing you
// were deciding about. The band keeps the row on screen, right above its own
// question.
export function ListCard({
  title,
  badge,
  detail,
  chips,
  open,
  onToggle,
  toggleLabel,
  editing,
  onEdit,
  editLabel,
  onRemove,
  removeLabel,
  removeConfirm,
  removeWarning,
  removeCancel,
  removeGo,
  read,
  children,
}: ListCardProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className={`rounded-card border-2 border-forest shadow-hard overflow-hidden ${
        open ? "bg-white" : "bg-mint"
      }`}
    >
      <div className="flex items-center gap-2 pr-2">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${toggleLabel}: ${title}`}
          onClick={onToggle}
          className="flex-1 min-w-0 min-h-[64px] pl-3 pr-1 py-2.5 text-left flex items-center gap-3"
        >
          {badge && (
            <span
              aria-hidden
              className="shrink-0 w-11 h-11 rounded-lg bg-cream border-2 border-forest flex items-center justify-center font-mono text-xs font-bold"
            >
              {badge}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block font-semibold truncate">{title}</span>
            {/* Counts survive opening — they are what the row IS, not a
                preview of it. A prose detail line is a preview, so it folds
                away once the content it summarises is on screen. */}
            {chips?.length ? (
              <span className="flex items-center gap-1.5 mt-1 flex-wrap">
                {chips.map((chip) => (
                  <span
                    key={chip.text}
                    className={`font-mono text-[9.5px] font-bold tracking-wider px-2 py-0.5 rounded-full ${
                      chip.tone === "muted"
                        ? "bg-sand/50 opacity-70"
                        : "bg-clover/20 text-forest"
                    }`}
                  >
                    {chip.text}
                  </span>
                ))}
              </span>
            ) : (
              detail &&
              !open && (
                <span className="block text-xs opacity-70 truncate">
                  {detail}
                </span>
              )
            )}
          </span>
        </button>

        {/* Edit sits next to the chevron rather than under the content: the two
            things you can do to an entry belong together, at its edge.
            A 28px chip, with an ::after stretching the hit area back to 44px —
            small to look at, still big enough to hit with a thumb. */}
        {open && !editing && (
          <button
            type="button"
            onClick={onEdit}
            className="relative shrink-0 h-7 inline-flex items-center gap-1.5 px-2.5 rounded-full border-2 border-forest bg-mint font-semibold text-xs after:absolute after:content-[''] after:inset-x-0 after:-inset-y-2"
          >
            <Pencil className="w-3 h-3" aria-hidden />
            {editLabel}
          </button>
        )}

        {onRemove && removeLabel && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`${removeLabel}: ${title}`}
            className="shrink-0 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full"
          >
            <Trash2 className="w-4 h-4 text-[#a8452f]" aria-hidden />
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
            className={`w-5 h-5 transition-transform duration-150 motion-reduce:transition-none ${
              open ? "rotate-90" : ""
            }`}
          />
        </button>
      </div>

      {confirming && onRemove && (
        <div
          role="alertdialog"
          aria-label={removeConfirm}
          className="border-t-2 border-forest bg-straw/25 px-3 py-3 flex items-center gap-2.5 flex-wrap"
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">{removeConfirm}</p>
            {removeWarning && (
              <p className="text-xs opacity-75 mt-0.5">{removeWarning}</p>
            )}
          </div>
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              autoFocus
              onClick={() => setConfirming(false)}
              className="min-h-[40px] px-3 rounded-full border-2 border-forest bg-white font-semibold text-xs"
            >
              {removeCancel}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onRemove();
              }}
              className="min-h-[40px] px-3 rounded-full border-2 border-forest bg-[#a8452f] text-cream font-semibold text-xs"
            >
              {removeGo}
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="px-4 pb-4 border-t-2 border-dashed border-sand pt-3">
          {editing ? children : read}
        </div>
      )}
    </div>
  );
}
