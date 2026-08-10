import Link from "next/link";
import { finishOnboarding } from "@/app/onboarding/actions";
import { ghostButton, primaryButton } from "@/components/ui/styles";
import type { Copy } from "@/lib/i18n";

export interface ReviewRow {
  label: string;
  value: string | null; // null → "Not set"
  editHref: string;
}

interface ReviewStepProps {
  copy: Copy["onboarding"];
  backHref: string;
  rows: ReviewRow[];
}

export function ReviewStep({ copy, backHref, rows }: ReviewStepProps) {
  return (
    <div>
      <h1 className="display-title text-3xl sm:text-4xl">{copy.review.title}</h1>
      <p className="mt-2 opacity-75">{copy.review.lead}</p>

      <dl className="flex flex-col gap-3 mt-6">
        {rows.map((row) => (
          <div
            key={row.label}
            className="bg-white border-2 border-forest rounded-card shadow-hard px-5 py-4 flex items-center justify-between gap-3"
          >
            <div>
              <dt className="text-xs uppercase tracking-widest font-semibold opacity-60">
                {row.label}
              </dt>
              <dd className={`font-semibold ${row.value ? "" : "opacity-50"}`}>
                {row.value ?? copy.review.notSet}
              </dd>
            </div>
            <Link
              href={row.editHref}
              className="font-semibold text-sm underline min-h-[44px] inline-flex items-center px-2"
            >
              {copy.config.edit}
            </Link>
          </div>
        ))}
      </dl>

      <div className="flex items-center gap-3 flex-wrap mt-8">
        <Link href={backHref} className={ghostButton}>
          {copy.back}
        </Link>
        <form action={finishOnboarding}>
          <button type="submit" className={primaryButton}>
            {copy.finish}
          </button>
        </form>
      </div>
    </div>
  );
}
