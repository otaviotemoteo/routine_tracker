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
}

// No dynamic rows — plain server-rendered form (native time inputs).
export function SleepStep({
  action,
  next,
  backHref,
  skipHref,
  submitLabel,
  copy,
  initialBedtime,
  initialWake,
}: SleepStepProps) {
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
            defaultValue={initialBedtime}
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
            defaultValue={initialWake}
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
      />
    </form>
  );
}
