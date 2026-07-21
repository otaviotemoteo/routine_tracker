"use client";

import { useCallback, useState } from "react";
import { CircleAlert, Pencil, Save } from "lucide-react";
import { HabitCard } from "@/components/HabitCard";
import { SavedDialog } from "@/components/SavedDialog";
import type { Copy, Lang } from "@/lib/i18n";
import type { CheckWithHabit } from "@/types/habit";

interface TodayChecklistProps {
  initialChecks: CheckWithHabit[];
  title: string;
  lang: Lang;
  copy: Copy["today"];
}

type Mode = "view" | "edit";

// The day is picked as a whole and confirmed once: cards edit a local draft,
// "I made it today" saves the batch and shows a confirmation dialog, and the
// screen then stays read-only until "Edit tasks" is pressed.
export function TodayChecklist({
  initialChecks,
  title,
  lang,
  copy,
}: TodayChecklistProps) {
  const [saved, setSaved] = useState(initialChecks);
  const [draft, setDraft] = useState(initialChecks);
  // Nothing recorded yet means the day still needs its first pass.
  const [mode, setMode] = useState<Mode>(
    initialChecks.some((c) => c.done) ? "view" : "edit"
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const editing = mode === "edit";
  const visible = editing ? draft : saved;

  const toggle = useCallback((id: number, done: boolean) => {
    setDraft((prev) => prev.map((c) => (c.id === id ? { ...c, done } : c)));
  }, []);

  async function save() {
    setSaving(true);
    setSaveError(false);
    try {
      const res = await fetch("/api/checks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: draft.map((c) => ({ id: c.id, done: c.done })),
        }),
      });
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
      setSaved(draft);
      setMode("view");
      setDialogOpen(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  function startEditing() {
    setDraft(saved);
    setSaveError(false);
    setMode("edit");
  }

  function cancelEditing() {
    setDraft(saved);
    setSaveError(false);
    setMode("view");
  }

  const required = visible.filter((c) => !c.optional);
  const doneCount = required.filter((c) => c.done).length;
  const percent =
    required.length === 0 ? 0 : Math.round((doneCount / required.length) * 100);
  const allDone = required.length > 0 && doneCount === required.length;
  // Only offer "cancel" when there's a saved state worth returning to.
  const canCancel = saved.some((c) => c.done);

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mt-2 mb-7">
        <h1 className="display-title text-4xl sm:text-5xl">{title}</h1>
        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            className="min-h-[44px] inline-flex items-center gap-2 px-5 rounded-full border-2 border-forest bg-white font-semibold text-sm shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm"
          >
            <Pencil aria-hidden className="w-4 h-4" />
            {copy.editButton}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <section
          aria-label={copy.progressAria}
          className="bg-white border-2 border-forest rounded-card shadow-hard px-5 py-4"
        >
          <div className="flex justify-between items-baseline font-semibold mb-2.5">
            <span>{allDone ? copy.dayComplete : copy.progress}</span>
            <span className="font-mono font-bold text-sm">
              {doneCount}/{required.length} · {percent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={required.length}
            aria-label={copy.progressAria}
            className="h-4 border-2 border-forest rounded-full bg-sand overflow-hidden"
          >
            <div
              className={`h-full bg-clover transition-[width] duration-300 ${
                percent > 0 && percent < 100 ? "border-r-2 border-forest" : ""
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          {editing && (
            <p className="text-sm opacity-75 mt-2.5">
              {canCancel ? copy.editHint : copy.firstHint}
            </p>
          )}
        </section>

        {saveError && (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm font-semibold bg-white border-2 border-forest rounded-card shadow-hard px-4 py-3"
          >
            <CircleAlert aria-hidden className="w-5 h-5 text-straw shrink-0" />
            {copy.saveError}
          </p>
        )}

        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4 list-none">
          {visible.map((check) => (
            <li key={check.id} className="contents">
              <HabitCard
                check={check}
                lang={lang}
                optionalLabel={copy.optional}
                interactive={editing}
                stateLabels={{ done: copy.doneSr, notDone: copy.notDoneSr }}
                onToggle={toggle}
              />
            </li>
          ))}
        </ul>

        {editing && (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 px-7 rounded-full border-2 border-forest bg-clover text-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-hard"
            >
              <Save aria-hidden className="w-5 h-5" />
              {saving ? copy.saving : copy.saveButton}
            </button>
            {canCancel && (
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="min-h-[48px] inline-flex items-center justify-center px-6 rounded-full border-2 border-forest bg-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm disabled:opacity-60"
              >
                {copy.cancel}
              </button>
            )}
          </div>
        )}
      </div>

      <SavedDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={copy.savedTitle}
        text={copy.savedText}
        closeLabel={copy.savedClose}
      />
    </>
  );
}
