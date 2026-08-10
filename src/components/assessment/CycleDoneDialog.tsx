"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { primaryButton } from "@/components/ui/styles";
import type { Copy } from "@/lib/i18n";

interface CycleDoneDialogProps {
  href: string;
  copy: Copy["assessment"];
}

// How long the button fills before it takes you there itself.
const COUNTDOWN_MS = 10_000;

// Shown over the directions index once the last direction is saved.
//
// This was a whole page whose only job was to say "done" and offer one link,
// which is a dialog wearing a route. As a dialog the index stays visible
// underneath, so finishing reads as landing back on your own list rather than
// being sent somewhere new.
//
// The countdown is a timer, NOT the animation: globals.css collapses every
// animation to 0.01ms under prefers-reduced-motion, so a redirect driven by
// animationend would fire instantly for exactly the people least likely to
// want it. And it is escapable — Escape, the backdrop, or touching the dialog
// cancels it, because an auto-navigation you cannot stop is hostile.
export function CycleDoneDialog({ href, copy }: CycleDoneDialogProps) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => router.push(href), COUNTDOWN_MS);
    return () => clearTimeout(id);
  }, [running, router, href]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="cycle-done-title"
      onClose={() => setRunning(false)}
      onPointerDown={() => setRunning(false)}
      onKeyDown={() => setRunning(false)}
      className="bg-transparent p-0 backdrop:bg-forest/40"
    >
      <div className="bg-white border-2 border-forest rounded-card shadow-hard p-6 w-[min(24rem,92vw)] text-forest text-center">
        <span
          aria-hidden
          className="mx-auto w-14 h-14 rounded-full border-2 border-forest bg-clover text-white flex items-center justify-center shadow-hard-sm"
        >
          <Check className="w-8 h-8" strokeWidth={3.5} />
        </span>

        <h2 id="cycle-done-title" className="display-title text-2xl mt-4">
          {copy.directions.doneTitle}
        </h2>
        <p className="mt-2 text-sm opacity-75">{copy.directions.doneLead}</p>

        <button
          type="button"
          onClick={() => router.push(href)}
          className={`${primaryButton} relative overflow-hidden w-full mt-6`}
        >
          {/* The fill is decoration over the label; the timer above is what
              actually navigates. */}
          {running && (
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-white/25 motion-safe:animate-fill-slow motion-reduce:hidden"
            />
          )}
          <span className="relative">{copy.directions.doneAction}</span>
        </button>
      </div>
    </dialog>
  );
}
