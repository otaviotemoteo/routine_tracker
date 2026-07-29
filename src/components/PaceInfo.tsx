"use client";

import { useRef, useState } from "react";
import { Info } from "lucide-react";
import type { Copy } from "@/lib/i18n";
import type { PaceValues } from "@/lib/setup-summary";

interface PaceInfoProps {
  copy: Copy["onboarding"]["reading"];
  // Without the numbers the dialog can only describe the formula; with them it
  // can show its own arithmetic.
  values?: PaceValues;
}

// The ⓘ next to any reading-pace figure: opens the formula *and the figures
// that produced it*. A tiny client island so server-rendered cards (Today,
// Overview) can still explain their numbers.
export function PaceInfo({ copy, values }: PaceInfoProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);

  // Let the close animation play before the dialog actually goes away.
  function close() {
    setClosing(true);
    setTimeout(() => {
      ref.current?.close();
      setClosing(false);
    }, 140);
  }

  const legend: { symbol: string; meaning: string; value?: number; tone: string }[] =
    [
      {
        symbol: "Pa",
        meaning: copy.paceLegendCurrent,
        value: values?.currentBookLeft,
        tone: "text-clover",
      },
      {
        symbol: "Pp",
        meaning: copy.paceLegendNext,
        value: values?.nextBooksPages,
        tone: "text-clover",
      },
      {
        symbol: "Dr",
        meaning: copy.paceLegendDays,
        value: values?.daysLeft,
        tone: "text-straw",
      },
    ];

  return (
    <>
      <button
        type="button"
        aria-label={copy.paceExplainAria}
        onClick={() => ref.current?.showModal()}
        className="shrink-0 inline-flex items-center justify-center text-forest/60 hover:text-forest"
      >
        <Info className="w-5 h-5" aria-hidden />
      </button>

      <dialog
        ref={ref}
        aria-labelledby="pace-explain-title"
        onClose={() => setClosing(false)}
        className={`bg-transparent p-0 backdrop:bg-forest/40 ${
          closing
            ? "motion-safe:animate-dialog-out"
            : "motion-safe:animate-dialog-in"
        }`}
      >
        <div className="bg-white border-2 border-forest rounded-card shadow-hard-lg p-6 w-[min(25rem,92vw)] text-forest text-left">
          <h2 id="pace-explain-title" className="display-title text-xl">
            {copy.paceExplainTitle}
          </h2>
          <p className="text-sm opacity-70 mt-1">{copy.paceSubtitle}</p>

          {/* The formula, with each term coloured the way it is in the legend. */}
          <p className="bg-cream rounded-card py-4 my-4 font-mono font-bold text-xl sm:text-2xl flex items-center justify-center gap-2">
            <span className="opacity-40">(</span>
            <span className="text-clover">Pa</span>
            <span className="opacity-40">+</span>
            <span className="text-clover">Pp</span>
            <span className="opacity-40">)</span>
            <span className="opacity-40">÷</span>
            <span className="text-straw">Dr</span>
          </p>

          <dl className="flex flex-col gap-2.5 text-sm">
            {legend.map((row) => (
              <div key={row.symbol} className="flex items-baseline gap-3">
                <dt
                  className={`font-mono font-bold w-7 shrink-0 ${row.tone}`}
                >
                  {row.symbol}
                </dt>
                <dd className="flex-1 opacity-75">{row.meaning}</dd>
                {row.value !== undefined && (
                  <dd className="font-mono font-bold shrink-0">{row.value}</dd>
                )}
              </div>
            ))}
          </dl>

          {values && (
            <p className="flex items-center justify-between gap-3 bg-straw/20 rounded-lg px-3.5 py-2.5 mt-4">
              <span className="text-sm font-bold">{copy.paceResultLabel}</span>
              <span className="font-mono font-bold">
                {values.perDay} {copy.paceUnit}
              </span>
            </p>
          )}

          <p className="text-sm opacity-70 mt-4 leading-relaxed">
            {copy.paceExplainText}
          </p>

          <button
            type="button"
            onClick={close}
            className="mt-5 w-full min-h-[48px] inline-flex items-center justify-center px-7 rounded-full border-2 border-forest bg-clover text-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm"
          >
            {copy.paceExplainClose}
          </button>
        </div>
      </dialog>
    </>
  );
}
