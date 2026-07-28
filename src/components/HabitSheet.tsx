"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { SHEET_BODIES } from "@/components/sheets";
import { habitName, type Copy, type Lang } from "@/lib/i18n";
import type { CheckWithHabit, TodayContext } from "@/types/habit";

interface HabitSheetProps {
  check: CheckWithHabit;
  context: TodayContext;
  lang: Lang;
  copy: Copy["sheets"];
  onClose: () => void;
  onSaved: (updated: CheckWithHabit) => void;
}

// Bottom sheet on mobile / centered dialog on desktop (native <dialog> gives
// focus-trap + Escape for free). Owns the note + save; the per-slug body owns
// the details it emits through onChange.
export function HabitSheet({
  check,
  context,
  lang,
  copy,
  onClose,
  onSaved,
}: HabitSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [details, setDetails] = useState<unknown>(check.details ?? null);
  const [note, setNote] = useState(check.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const Body = SHEET_BODIES[check.slug];

  async function save() {
    setSaving(true);
    setError(false);
    try {
      const res = await fetch(`/api/checks/${check.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          done: true,
          details,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
      onSaved(await res.json());
    } catch {
      setError(true);
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="sheet-title"
      className="w-full sm:max-w-md m-0 mt-auto sm:m-auto bg-transparent p-0 backdrop:bg-forest/40"
    >
      <div className="bg-white border-2 border-forest rounded-t-card sm:rounded-card shadow-hard p-6 max-h-[85vh] overflow-y-auto text-forest">
        <div className="flex items-center justify-between mb-5">
          <h2 id="sheet-title" className="display-title text-2xl">
            {habitName(lang, check.slug, check.name)}
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label={copy.close}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border-2 border-forest bg-white"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        {Body && (
          <Body
            context={context}
            initial={check.details}
            copy={copy}
            lang={lang}
            onChange={setDetails}
          />
        )}

        <label htmlFor="sheet-note" className="block mt-5 mb-1.5 font-semibold text-sm">
          {copy.note}
        </label>
        <textarea
          id="sheet-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={copy.notePlaceholder}
          className="w-full px-3 py-2 border-2 border-forest rounded-lg bg-cream focus:bg-white min-h-[60px]"
        />

        {error && (
          <p
            role="alert"
            className="mt-3 text-sm font-semibold bg-mint border-2 border-forest rounded-lg px-3 py-2"
          >
            {copy.saveError}
          </p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 min-h-[48px] inline-flex items-center justify-center px-6 rounded-full border-2 border-forest bg-clover text-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm disabled:opacity-60"
          >
            {saving ? copy.saving : copy.save}
          </button>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="min-h-[48px] inline-flex items-center justify-center px-5 rounded-full border-2 border-forest bg-white font-semibold shadow-hard"
          >
            {copy.close}
          </button>
        </div>
      </div>
    </dialog>
  );
}
