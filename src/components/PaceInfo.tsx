"use client";

import { useRef, useState } from "react";
import { Info } from "lucide-react";
import type { Copy } from "@/lib/i18n";

interface PaceInfoProps {
  copy: Copy["onboarding"]["reading"];
}

// The ⓘ next to any reading-pace figure: opens the formula behind it. A tiny
// client island so server-rendered cards (Today, Overview) can still explain
// their numbers.
export function PaceInfo({ copy }: PaceInfoProps) {
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

  const legend: [string, string][] = [
    ["Pc", copy.paceLegendCurrent],
    ["Pn", copy.paceLegendNext],
    ["Dr", copy.paceLegendDays],
  ];

  return (
    <>
      <button
        type="button"
        aria-label={copy.paceExplainAria}
        onClick={() => ref.current?.showModal()}
        className="shrink-0 inline-flex items-center justify-center text-forest/70 hover:text-forest"
      >
        <Info className="w-5 h-5" aria-hidden />
      </button>

      <dialog
        ref={ref}
        aria-labelledby="pace-explain-title"
        onClose={() => setClosing(false)}
        className={`bg-transparent p-0 backdrop:bg-forest/40 ${
          closing ? "motion-safe:animate-dialog-out" : "motion-safe:animate-dialog-in"
        }`}
      >
        <div className="bg-white border-2 border-forest rounded-card shadow-hard p-6 w-[min(24rem,92vw)] text-forest">
          <h2 id="pace-explain-title" className="display-title text-xl">
            {copy.paceExplainTitle}
          </h2>

          <p className="font-mono font-bold text-2xl sm:text-3xl text-center my-5">
            {copy.paceFormula}
          </p>

          <dl className="flex flex-col gap-1.5 text-sm">
            {legend.map(([symbol, meaning]) => (
              <div key={symbol} className="flex gap-2">
                <dt className="font-mono font-bold text-clover w-8 shrink-0">
                  {symbol}
                </dt>
                <dd className="opacity-75">{meaning}</dd>
              </div>
            ))}
            <div className="flex gap-2 border-t-2 border-dashed border-sand pt-1.5 mt-1">
              <dt className="font-mono font-bold w-8 shrink-0">=</dt>
              <dd className="font-semibold">{copy.paceLegendResult}</dd>
            </div>
          </dl>

          <p className="mt-4 text-sm opacity-75">{copy.paceExplainText}</p>

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
