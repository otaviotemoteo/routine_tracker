import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { domainIcon } from "@/lib/domain-icons";
import type { DomainGap } from "@/lib/diagnose";
import { format, type Copy } from "@/lib/i18n";

interface AddAreaPickerProps {
  // The areas not already being built on, worst distance first.
  remaining: DomainGap[];
  copy: Copy["assessment"];
}

// "Include another area".
//
// The cut at five is arithmetic, and the results screen already admits out
// loud that it is somewhat arbitrary when the areas are bunched. This is where
// that admission becomes actionable: it is the last moment before habits are
// proposed, and the only place the person — rather than the engine — gets to
// say which areas the cycle is about.
//
// What it does NOT do is rewrite priority_domains. That column was frozen when
// the assessment was sealed, and it is the record of what the engine said from
// the answers given. Adding an area here means writing a sixth direction; the
// frozen cut stays exactly as it was, which is what makes a cycle from six
// months ago still readable as what actually happened.
//
// A native <details> rather than a state toggle: it is a disclosure, it works
// before hydration, and it keeps this screen a server component.
export function AddAreaPicker({ remaining, copy }: AddAreaPickerProps) {
  if (remaining.length === 0) return null;

  return (
    <details className="group mt-8 border-2 border-forest rounded-card bg-white shadow-hard overflow-hidden">
      <summary className="min-h-[56px] flex items-center gap-2.5 px-4 py-3 cursor-pointer font-semibold list-none [&::-webkit-details-marker]:hidden">
        <Plus className="w-5 h-5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">{copy.areas.addTitle}</span>
        <ChevronDown
          className="w-5 h-5 shrink-0 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </summary>

      <div className="border-t-2 border-forest px-4 py-3.5">
        <p className="text-sm opacity-75">{copy.areas.addLead}</p>

        <ul className="flex flex-col gap-2 mt-3.5 list-none">
          {remaining.map((row) => {
            const Icon = domainIcon(row.domainSlug);
            return (
              <li key={row.domainSlug}>
                <Link
                  href={`/onboarding/directions?domain=${row.domainSlug}&from=areas`}
                  className="min-h-[48px] flex items-center gap-2.5 px-3 rounded-lg border-2 border-forest bg-cream hover:bg-mint"
                >
                  <Icon className="w-4 h-4 shrink-0 text-clover" aria-hidden />
                  <span className="min-w-0 flex-1 font-semibold break-words">
                    {copy.domains[row.domainSlug].name}
                  </span>
                  {/* The distance, so the ordering explains itself rather than
                      asking to be trusted. */}
                  <span className="shrink-0 font-mono text-xs opacity-60">
                    {row.gap > 0
                      ? format(copy.areas.addGap, { n: row.gap })
                      : copy.areas.addNoGap}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
