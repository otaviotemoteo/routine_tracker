import Link from "next/link";
import { Pencil } from "lucide-react";
import { domainIcon } from "@/lib/domain-icons";
import { cardSurface } from "@/components/ui/styles";
import type { Finding } from "@/lib/diagnose";
import type { DomainSlug } from "@/lib/domains";
import type { NarrativeRow } from "@/db/assessment";
import type { Copy } from "@/lib/i18n";

interface AreaCardsProps {
  areas: DomainSlug[];
  written: Record<string, NarrativeRow>;
  // Same findings the results/directions screens diagnose from the sealed
  // ratings — not recomputed differently here, so all three can't disagree
  // about why an area is on the list. See DirectionsIndex's own comment.
  findings: Finding[];
  copy: Copy["assessment"];
}

// The areas a cycle's habits will come from, one card each.
//
// Deliberately not the same component as DirectionsIndex, even though both
// list the priority areas. That one is a task list — it reports which
// directions are still to write and its rows are the way into writing them.
// This one is the last read before the habits are proposed, so the direction
// itself is the content rather than a truncated preview of a pending task.
export function AreaCards({ areas, written, findings, copy }: AreaCardsProps) {
  return (
    <ul className="flex flex-col gap-3 list-none">
      {areas.map((slug) => {
        const Icon = domainIcon(slug);
        const narrative = written[slug]?.narrative?.trim();
        const own = findings.filter((f) => f.domainSlug === slug);

        return (
          <li key={slug} className={`${cardSurface} p-4`}>
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="shrink-0 w-10 h-10 rounded-full border-2 border-forest bg-mint flex items-center justify-center"
              >
                <Icon className="w-5 h-5" />
              </span>

              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-lg break-words">
                  {copy.domains[slug].name}
                </h2>
                {/* The sentence in full, not truncated: it is what the
                    suggestions will be written from, so a reader has to be
                    able to check it against what they meant. An area with no
                    direction says so in words rather than being left blank. */}
                <p
                  className={`mt-1 leading-relaxed break-words ${
                    narrative ? "" : "opacity-60 italic"
                  }`}
                >
                  {narrative ?? copy.areas.noDirection}
                </p>

                {own.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5 mt-2.5 list-none">
                    {own.map((finding) => (
                      <li
                        key={finding.pattern}
                        className="text-xs font-semibold border-[1.5px] border-forest rounded-full bg-white px-2.5 py-1"
                      >
                        {copy.patterns[finding.pattern].importance}
                        {copy.patterns[finding.pattern].action
                          ? ` · ${copy.patterns[finding.pattern].action}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Editing means leaving for the direction form. The card reports;
                it does not grow a textarea. */}
            <div className="flex justify-end mt-3">
              <Link
                href={`/onboarding/directions?domain=${slug}&from=areas`}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-3 -mr-1 font-semibold text-sm underline"
              >
                <Pencil className="w-4 h-4" aria-hidden />
                {copy.areas.edit}
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
