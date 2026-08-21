import Link from "next/link";
import { Pencil } from "lucide-react";
import { domainIcon } from "@/lib/domain-icons";
import type { Finding } from "@/lib/diagnose";
import type { DomainSlug } from "@/lib/domains";
import type { NarrativeRow } from "@/db/assessment";
import type { Copy } from "@/lib/i18n";

interface DirectionsIndexProps {
  priority: DomainSlug[];
  written: Record<string, NarrativeRow>;
  // Same findings the results page diagnoses from the sealed ratings — not
  // recomputed differently here, so the two screens can never disagree about
  // why a direction is on the list. Badge style deliberately matches
  // PriorityList's own (neutral border, no severity colour): this app
  // already decided self-report never gets graded by colour, and a badge
  // here is the same fact as there, just relocated.
  findings: Finding[];
  copy: Copy["assessment"];
}

// The five priority areas as review cards — Screen 1 of the designed
// onboarding flow. Editar goes back to that direction's own writing screen;
// saving from there returns HERE, never marches forward (see DirectionStep's
// own "reviewing" branch) — this is the page you land back on, not a step
// you walk through again.
export function DirectionsIndex({
  priority,
  written,
  findings,
  copy,
}: DirectionsIndexProps) {
  return (
    <ul className="flex flex-col gap-3.5 list-none">
      {priority.map((slug) => {
        const Icon = domainIcon(slug);
        const row = written[slug];
        const done = Boolean(row?.narrative?.trim());
        const own = findings.filter((f) => f.domainSlug === slug);

        return (
          <li
            key={slug}
            className={`relative border-2 border-forest rounded-card shadow-hard px-5 py-4 pr-[76px] flex gap-3.5 ${
              done ? "bg-white" : "bg-cream"
            }`}
          >
            <span
              aria-hidden
              className="shrink-0 w-[46px] h-[46px] rounded-full bg-mint border-2 border-forest flex items-center justify-center"
            >
              <Icon className="w-[21px] h-[21px] text-forest" />
            </span>

            <div className="min-w-0 flex-1 flex flex-col gap-2">
              <span
                className="font-display font-bold text-lg tracking-wide"
                style={{ fontVariantCaps: "small-caps" }}
              >
                {copy.domains[slug].name}
              </span>
              <p className="text-sm leading-snug text-forest/85">
                {done ? row.narrative : copy.directions.indexEmpty}
              </p>

              {own.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 mt-0.5 list-none">
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

            <Link
              href={`/onboarding/directions?domain=${slug}`}
              aria-label={`${copy.directions.indexEdit} ${copy.domains[slug].name}`}
              className="absolute top-4 right-4 w-10 h-10 rounded-lg border-2 border-forest bg-white shadow-hard-sm flex items-center justify-center transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5"
            >
              <Pencil className="w-[18px] h-[18px]" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
