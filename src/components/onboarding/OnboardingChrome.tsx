import Link from "next/link";

// Shared Tailwind class strings so every step's inputs look identical.
// `fieldBase` carries no width — use it when the caller sets its own (two
// width utilities on one element fight, and the stylesheet order decides).
export const fieldBase =
  "min-h-[44px] px-3 border-2 border-forest rounded-lg bg-cream focus:bg-white";
export const inputClass = `${fieldBase} w-full`;
export const primaryButton =
  "min-h-[48px] inline-flex items-center justify-center gap-2 px-7 rounded-full border-2 border-forest bg-clover text-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm disabled:opacity-60";
export const ghostButton =
  "min-h-[44px] inline-flex items-center justify-center px-5 rounded-full border-2 border-forest bg-white font-semibold text-sm shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm";

interface ProgressProps {
  stepNumber: number;
  total: number;
  label: string;
}

export function OnboardingProgress({ stepNumber, total, label }: ProgressProps) {
  const percent = Math.round((stepNumber / total) * 100);
  return (
    <div className="mb-6">
      <p className="eyebrow mb-2">{label}</p>
      <div
        role="progressbar"
        aria-valuenow={stepNumber}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={label}
        className="h-3 border-2 border-forest rounded-full bg-sand overflow-hidden"
      >
        <div
          className="h-full bg-clover transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

interface FooterProps {
  backHref?: string;
  skipHref?: string;
  skipLabel: string;
  backLabel: string;
  submitLabel: string;
}

// Rendered inside each step's <form>: Back/Skip are plain links (no save),
// Continue submits the form (saves, then advances via the server action).
export function OnboardingFooter({
  backHref,
  skipHref,
  skipLabel,
  backLabel,
  submitLabel,
}: FooterProps) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mt-8">
      <div>
        {backHref && (
          <Link href={backHref} className={ghostButton}>
            {backLabel}
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3">
        {skipHref && (
          <Link href={skipHref} className="font-semibold text-sm underline min-h-[44px] inline-flex items-center px-2">
            {skipLabel}
          </Link>
        )}
        <button type="submit" className={primaryButton}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
