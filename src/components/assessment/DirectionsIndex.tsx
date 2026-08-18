import Link from "next/link";
import { Check, Clock, Pencil } from "lucide-react";
import { domainIcon } from "@/lib/domain-icons";
import type { DomainSlug } from "@/lib/domains";
import type { NarrativeRow } from "@/db/assessment";
import type { Copy } from "@/lib/i18n";

interface DirectionsIndexProps {
  priority: DomainSlug[];
  written: Record<string, NarrativeRow>;
  copy: Copy["assessment"];
}

// The five priority areas at a glance, one row each.
//
// Coming back to review a direction used to drop you at area one and make you
// walk all five to reach the fifth. A resumed task opens as an index, not a
// replay — the same rule the daily flow follows, and this screen is its twin.
export function DirectionsIndex({
  priority,
  written,
  copy,
}: DirectionsIndexProps) {
  return (
    <ul className="flex flex-col gap-3 list-none">
      {priority.map((slug) => {
        const Icon = domainIcon(slug);
        const row = written[slug];
        const done = Boolean(row?.narrative?.trim());

        return (
          <li key={slug}>
            <Link
              href={`/onboarding/directions?domain=${slug}`}
              className={`min-h-[64px] flex items-center gap-3 px-4 py-3 rounded-card border-2 border-forest shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm ${
                done ? "bg-mint" : "bg-white"
              }`}
            >
              <span
                aria-hidden
                className={`w-[30px] h-[30px] shrink-0 rounded-lg border-2 border-forest flex items-center justify-center ${
                  done ? "bg-clover text-white" : "bg-straw/30"
                }`}
              >
                {done ? (
                  <Check className="w-5 h-5" strokeWidth={3.5} />
                ) : (
                  <Clock className="w-4 h-4 text-forest/75" strokeWidth={2.5} />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold">
                  <Icon aria-hidden className="w-4 h-4 text-clover shrink-0" />
                  {copy.domains[slug].name}
                </span>
                {/* What you wrote, so the row reports rather than just links. */}
                <span className="block text-sm opacity-70 truncate">
                  {done ? row.narrative : copy.directions.indexEmpty}
                </span>
              </span>

              <span
                aria-hidden
                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold"
              >
                <Pencil className="w-3 h-3" />
                {copy.directions.indexEdit}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
