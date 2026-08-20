"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { sheetBodyFor } from "@/components/sheets";
import { format, habitName, type Copy, type Lang } from "@/lib/i18n";
import type { ActivityContext, CheckWithActivity } from "@/types/habit";

interface DailyStepProps {
  check: CheckWithActivity;
  // Already resolved to this activity's own slice — see the /day page,
  // which reads context.activities[check.activityId].
  context: ActivityContext;
  lang: Lang;
  copy: Copy["daily"];
  sheetCopy: Copy["sheets"];
  nextHref: string;
  backHref?: string;
  isLast: boolean;
}

// One habit of the guided daily flow. The per-habit form bodies are the same
// ones the old modal used (src/components/sheets) — here they're steps.
export function DailyStep({
  check,
  context,
  lang,
  copy,
  sheetCopy,
  nextHref,
  backHref,
  isLast,
}: DailyStepProps) {
  const router = useRouter();
  const [details, setDetails] = useState<unknown>(check.details ?? null);
  const [note, setNote] = useState(check.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  // Always resolves — a habit with no template gets the generic body rather
  // than a note-only step with nothing to answer.
  const Body = sheetBodyFor(check.templateKind);
  const name = habitName(lang, check.slug, check.name);

  async function saveAndContinue() {
    setSaving(true);
    setError(false);
    try {
      const res = await fetch(`/api/checks/${check.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true, details, note: note.trim() || null }),
      });
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
      router.push(nextHref);
      // The save happened outside the router's knowledge, so the destination
      // (the next step, or Today at the end) would render from a stale cache.
      router.refresh();
    } catch {
      setError(true);
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h1 className="display-title text-3xl sm:text-4xl flex items-center gap-3">
          {/* Up to the day's areas. The footer's Back steps to the previous
              habit; this leaves the flow entirely. */}
          <Link
            href="/day"
            aria-label={copy.back}
            className="shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2"
          >
            <ArrowLeft className="w-7 h-7" aria-hidden />
          </Link>
          {format(copy.question, { habit: name })}
        </h1>
        {check.done && (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-clover">
            <Check className="w-4 h-4" strokeWidth={3} aria-hidden />
            {copy.doneToday}
          </span>
        )}
      </div>

      <div className="mt-6 bg-white border-2 border-forest rounded-card shadow-hard p-5">
        <Body
          context={context}
          initial={check.details}
          copy={sheetCopy}
          lang={lang}
          onChange={setDetails}
          habit={check}
        />

        <label
          htmlFor="daily-note"
          className="block mt-5 mb-1.5 font-semibold text-sm"
        >
          {sheetCopy.note}
        </label>
        <textarea
          id="daily-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={sheetCopy.notePlaceholder}
          className="w-full px-3 py-2 border-2 border-forest rounded-lg bg-cream focus:bg-white min-h-[60px]"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 text-sm font-semibold bg-mint border-2 border-forest rounded-lg px-3 py-2"
        >
          {copy.saveError}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap mt-6">
        <div>
          {backHref && (
            <Link
              href={backHref}
              className="min-h-[44px] inline-flex items-center justify-center px-5 rounded-full border-2 border-forest bg-white font-semibold text-sm shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg"
            >
              {copy.back}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Skip leaves the check untouched and moves on. */}
          <Link
            href={nextHref}
            className="font-semibold text-sm underline min-h-[44px] inline-flex items-center px-2"
          >
            {copy.skip}
          </Link>
          <button
            type="button"
            onClick={saveAndContinue}
            disabled={saving}
            className="min-h-[48px] inline-flex items-center justify-center gap-2 px-7 rounded-full border-2 border-forest bg-clover text-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm disabled:opacity-60"
          >
            {saving && (
              <Loader2
                className="w-4 h-4 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            )}
            {saving ? copy.saving : isLast ? copy.finish : copy.save}
          </button>
        </div>
      </div>
    </div>
  );
}
