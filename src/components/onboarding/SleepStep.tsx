"use client";

import { useState } from "react";
import { inputClass, OnboardingFooter } from "./OnboardingChrome";
import type { Copy } from "@/lib/i18n";

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
}

// Controlled (rather than defaultValue) so dirty-tracking can compare against
// what was loaded.
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
}: SleepStepProps) {
  const [bedtime, setBedtime] = useState(initialBedtime);
  const [wakeTime, setWakeTime] = useState(initialWake);
  const dirty = bedtime !== initialBedtime || wakeTime !== initialWake;

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <h1 className="display-title text-3xl sm:text-4xl">{copy.sleep.title}</h1>
      <p className="mt-2 opacity-75">{copy.sleep.lead}</p>

      <div className="flex gap-4 mt-6 flex-wrap">
        <div>
          <label htmlFor="bedtime" className="block mb-1.5 font-semibold text-sm">
            {copy.sleep.bedtime}
          </label>
          <input
            id="bedtime"
            name="bedtime"
            type="time"
            value={bedtime}
            onChange={(e) => setBedtime(e.target.value)}
            className={`${inputClass} font-mono max-w-[9rem]`}
          />
        </div>
        <div>
          <label htmlFor="wakeTime" className="block mb-1.5 font-semibold text-sm">
            {copy.sleep.wake}
          </label>
          <input
            id="wakeTime"
            name="wakeTime"
            type="time"
            value={wakeTime}
            onChange={(e) => setWakeTime(e.target.value)}
            className={`${inputClass} font-mono max-w-[9rem]`}
          />
        </div>
      </div>

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
