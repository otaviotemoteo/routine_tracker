import Link from "next/link";
import { ghostButton, primaryButton } from "@/components/ui/styles";
import { TOTAL_DOMAINS } from "@/lib/domains";
import { format, type Copy } from "@/lib/i18n";

interface ResumeStepProps {
  restart: () => Promise<void>;
  resumeHref: string;
  startedOn: string;
  answered: number;
  copy: Copy["assessment"];
}

// Shown when a draft was begun on an earlier day.
//
// The check-in asks how much you acted "over the last week", so a grid spread
// across three weeks is answering about three different weeks and its date is
// a partial lie. Rather than silently resuming or silently discarding, it says
// the facts and lets the person choose. Same principle as the daily flow
// opening as an index instead of replaying from step one.
export function ResumeStep({
  restart,
  resumeHref,
  startedOn,
  answered,
  copy,
}: ResumeStepProps) {
  return (
    <div>
      <p className="eyebrow mb-2">{copy.intro.eyebrow}</p>
      <h1 className="display-title text-3xl sm:text-4xl">{copy.resume.title}</h1>
      <p className="mt-3 opacity-80">
        {format(copy.resume.lead, {
          date: startedOn,
          done: answered,
          total: TOTAL_DOMAINS,
        })}
      </p>

      <div className="flex flex-wrap items-center gap-3 mt-7">
        <Link href={resumeHref} className={primaryButton}>
          {copy.resume.resumeAction}
        </Link>
        <form action={restart}>
          <button type="submit" className={ghostButton}>
            {copy.resume.restartAction}
          </button>
        </form>
      </div>

      <p className="mt-4 text-sm opacity-70">{copy.resume.restartNote}</p>
    </div>
  );
}
