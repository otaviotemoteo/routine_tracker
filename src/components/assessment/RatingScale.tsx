"use client";

import { useId, useState } from "react";
import { SCALE_MAX, SCALE_MIN } from "@/lib/domains";
import { format } from "@/lib/i18n";

interface RatingScaleProps {
  name: string;
  label: string;
  question: string;
  // The line that earns the answer. Always visible, never behind a disclosure:
  // a question you have to go looking for the reason for is a question people
  // answer carelessly.
  why: string;
  lowAnchor: string;
  highAnchor: string;
  whyLabel: string;
  // Short, and shown where the number will go.
  unansweredLabel: string;
  // The longer sentence, for aria-valuetext only — it says how to answer,
  // which is useful read aloud and noise on screen.
  unansweredHint: string;
  // "{value} of 10". Deliberately just the number: naming the nearest anchor
  // would have a 6 announced as "wide open", which is a claim the answer never
  // made. Which end is which is said once, on focus, by rangeTemplate.
  valueTemplate: string;
  // "from {low} to {high}" — the orientation, announced when the control takes
  // focus rather than repeated on every arrow press.
  rangeTemplate: string;
  value: number | null;
  onChange: (value: number) => void;
}

const STEPS = SCALE_MAX - SCALE_MIN + 1;
// Where the thumb rests before anyone has touched it. The midpoint is the
// least suggestive place to start, and it is never submitted as an answer.
const RESTING = Math.round((SCALE_MIN + SCALE_MAX) / 2);

// One 1–10 question.
//
// The hard part is a state a range input does not have: unanswered. A range
// always holds a value and always draws a thumb, so rendering one with a
// default silently answers the question for the person — six times per screen,
// invisibly, and in exactly the direction that makes the whole grid worthless.
//
// So `value` is `number | null`, and null is carried in three places at once:
// the readout says so in words where the number will go, the thumb greys out,
// and the parent's Continue stays disabled. The `input` event covers dragging and the arrow keys, and
// `pointerdown` covers the case the `input` event misses: tapping the track at
// exactly the resting position, where the value never changes and no event
// fires, leaving the answer null under the person's finger.
export function RatingScale({
  name,
  label,
  question,
  why,
  lowAnchor,
  highAnchor,
  whyLabel,
  unansweredLabel,
  unansweredHint,
  valueTemplate,
  rangeTemplate,
  value,
  onChange,
}: RatingScaleProps) {
  const id = useId();
  const rangeId = `${id}-range`;
  const [dragging, setDragging] = useState(false);
  const answered = value !== null;
  const shown = value ?? RESTING;
  // 0 at the low end, 1 at the high end.
  const ratio = (shown - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);

  return (
    <fieldset className="border-2 border-forest rounded-card bg-white px-4 py-3.5">
      <legend className="sr-only">{label}</legend>

      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold leading-snug min-w-0">{question}</p>
        {/* The answer, or the words "not answered yet" in its place.
            Deliberately the same slot: when the state lived on its own line
            below, answering a question made the card shrink and the page
            reflowed under the thumb that had just moved the slider. */}
        <output
          htmlFor={id}
          aria-hidden
          className="shrink-0 w-[4.75rem] min-h-[2rem] flex items-start justify-end text-right leading-tight"
        >
          {answered ? (
            <span className="font-mono text-2xl font-bold tabular-nums">
              {value}
            </span>
          ) : (
            <span className="text-xs font-semibold text-straw">
              {unansweredLabel}
            </span>
          )}
        </output>
      </div>

      <p className="mt-1.5 text-sm opacity-75 leading-snug">
        <span className="sr-only">{whyLabel}: </span>
        {why}
      </p>

      <div className="relative mt-3 h-11">
        {/* The visual track, behind the input. Ten notches, so the scale reads
            as ten choices rather than as a continuum. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2.5 rounded-full border-2 border-forest bg-cream overflow-hidden"
        >
          <div
            className={`h-full transition-[width] duration-100 ${
              answered ? "bg-clover" : "bg-transparent"
            }`}
            style={{ width: `${ratio * 100}%` }}
          />
          {/* One notch per step, at the exact value positions, so the scale
              reads as ten choices rather than as a continuum. */}
          {Array.from({ length: STEPS - 2 }, (_, i) => (
            <span
              key={i}
              className="absolute top-0 w-px h-full bg-forest/20"
              style={{ left: `${((i + 1) / (STEPS - 1)) * 100}%` }}
            />
          ))}
        </div>

        <input
          id={id}
          name={name}
          type="range"
          min={SCALE_MIN}
          max={SCALE_MAX}
          step={1}
          value={shown}
          data-answered={answered}
          aria-label={question}
          aria-describedby={rangeId}
          aria-valuetext={
            answered ? format(valueTemplate, { value: shown }) : unansweredHint
          }
          onChange={(e) => onChange(Number(e.target.value))}
          // Tapping the track exactly where the thumb already sits fires no
          // change event. Without this the question stays unanswered while
          // looking answered.
          onPointerDown={() => {
            setDragging(true);
            if (!answered) onChange(RESTING);
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onKeyDown={(e) => {
            if (!answered && (e.key === "Enter" || e.key === " ")) {
              onChange(RESTING);
            }
          }}
          className={`rating-range relative w-full h-11 bg-transparent cursor-pointer ${
            dragging ? "" : "transition-none"
          }`}
        />
      </div>

      {/* Both ends named in words. The number alone never says which end is
          "good", and on most of these scales neither end is. The top margin
          sits close to it: the focus ring is inset (see globals.css) so it no
          longer needs clearing. */}
      <div
        id={rangeId}
        className="flex justify-between gap-3 mt-0.5 text-xs opacity-70"
      >
        <span>{lowAnchor}</span>
        <span className="text-right">{highAnchor}</span>
        <span className="sr-only">
          {format(rangeTemplate, { low: lowAnchor, high: highAnchor })}
        </span>
      </div>

    </fieldset>
  );
}
