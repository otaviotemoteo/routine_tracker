"use client";

import { useEffect, useRef } from "react";
import { CircleCheckBig } from "lucide-react";

interface SavedDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
  closeLabel: string;
}

const AUTO_CLOSE_MS = 5000;

// Native <dialog> gives focus trapping, Escape-to-close and inertness for
// free. The dialog dismisses itself after AUTO_CLOSE_MS; the close button
// fills up meanwhile so the countdown is visible rather than surprising.
export function SavedDialog({
  open,
  onClose,
  title,
  text,
  closeLabel,
}: SavedDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => ref.current?.close(), AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="saved-dialog-title"
      className="bg-transparent p-0 backdrop:bg-forest/40"
    >
      <div className="bg-white border-2 border-forest rounded-card shadow-hard p-6 sm:p-8 w-[min(22rem,90vw)] text-center text-forest">
        <CircleCheckBig aria-hidden className="w-10 h-10 text-clover mx-auto" />
        <h2 id="saved-dialog-title" className="display-title text-2xl mt-3">
          {title}
        </h2>
        <p className="mt-2 opacity-75">{text}</p>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="relative overflow-hidden mt-5 min-h-[48px] w-full inline-flex items-center justify-center px-7 rounded-full border-2 border-forest bg-clover text-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm"
        >
          {open && (
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-white/30 motion-safe:animate-fill motion-reduce:hidden"
            />
          )}
          <span className="relative">{closeLabel}</span>
        </button>
      </div>
    </dialog>
  );
}
