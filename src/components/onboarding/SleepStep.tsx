"use client";

import { useState } from "react";
import { OnboardingFooter, StepTitle } from "./OnboardingChrome";
import { SetupPanel } from "./SetupPanel";
import { inputClass } from "@/components/ui/styles";
import { format, type Copy } from "@/lib/i18n";

interface SleepStepProps {
  action: (formData: FormData) => Promise<void>;
  next: string;
  backHref?: string;
  skipHref?: string;
  submitLabel: string;
  copy: Copy["onboarding"];
  initialBedtime: string;
  initialWake: string;
  requireDirtyToSave?: boolean;
  titleBackHref?: string;
  // Trailing average of what was actually slept. Absent during onboarding,
  // where there is no history yet — and a "current average" invented from no
  // nights would be the exact thing this app refuses to print.
  averageHours?: number | null;
}

// Hours between the two times, wrapping past midnight: 23:00 → 06:00 is seven
// hours, not minus seventeen.
function windowHours(bedtime: string, wakeTime: string): number {
  const mins = (t: string) => {
    const [h, m] = t.slice(0, 5).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  return Math.round((((mins(wakeTime) - mins(bedtime)) % 1440) + 1440) % 1440 / 60);
}

function asHoursMinutes(hours: number): string {
  const whole = Math.floor(hours);
  const mins = Math.round((hours - whole) * 60);
  return mins === 0 ? `${whole}h` : `${whole}h${String(mins).padStart(2, "0")}`;
}

// Controlled (rather than defaultValue) so dirty-tracking can compare against
// what was loaded — and so the window below the fields recomputes as you type.
export function SleepStep({
  action,
  next,
  backHref,
  skipHref,
  submitLabel,
  copy,
  initialBedtime,
  initialWake,
  requireDirtyToSave,
  titleBackHref,
  averageHours,
}: SleepStepProps) {
  const [bedtime, setBedtime] = useState(initialBedtime);
  const [wakeTime, setWakeTime] = useState(initialWake);
  const dirty = bedtime !== initialBedtime || wakeTime !== initialWake;
  const hours = windowHours(bedtime, wakeTime);

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <StepTitle backHref={titleBackHref} backLabel={copy.back}>
        {copy.sleep.title}
      </StepTitle>
      <p className="mt-2 mb-5 opacity-75">{copy.sleep.lead}</p>

      <SetupPanel label={copy.sleep.targetLabel} lead={copy.sleep.targetLead}>
        <div className="flex items-end gap-2.5 flex-wrap">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="bedtime"
              className="block mb-1.5 font-semibold text-sm"
            >
              {copy.sleep.bedtime}
            </label>
            <input
              id="bedtime"
              name="bedtime"
              type="time"
              value={bedtime}
              onChange={(e) => setBedtime(e.target.value)}
              className={`${inputClass} font-mono w-full`}
            />
          </div>
          <span aria-hidden className="h-[46px] flex items-center opacity-40">
            —
          </span>
          <div className="min-w-0 flex-1">
            <label
              htmlFor="wakeTime"
              className="block mb-1.5 font-semibold text-sm"
            >
              {copy.sleep.wake}
            </label>
            <input
              id="wakeTime"
              name="wakeTime"
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className={`${inputClass} font-mono w-full`}
            />
          </div>
        </div>

        {/* What the two fields add up to, recomputed as they change. The
            target and what actually happens sit on one line so the gap
            between them is the thing you read, not two figures to subtract. */}
        <div className="mt-3 bg-mint rounded-lg px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <span className="font-semibold text-sm">
            {format(copy.sleep.window, { n: hours })}
          </span>
          {typeof averageHours === "number" && (
            <span className="font-mono text-[11px] font-bold opacity-60">
              {format(copy.sleep.average, { v: asHoursMinutes(averageHours) })}
            </span>
          )}
        </div>
      </SetupPanel>

      <OnboardingFooter
        backHref={backHref}
        skipHref={skipHref}
        skipLabel={copy.skip}
        backLabel={copy.back}
        submitLabel={submitLabel}
        copy={copy}
        dirty={dirty}
        requireDirtyToSave={requireDirtyToSave}
      />
    </form>
  );
}
