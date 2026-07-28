import Link from "next/link";
import { Pencil } from "lucide-react";
import type { Copy } from "@/lib/i18n";
import type { SetupRow } from "@/lib/setup-summary";

interface ActivitiesSectionProps {
  rows: SetupRow[];
  copy: Copy["today"];
}

// The configured setup, editable in place — each card links to its step in
// /config (which reuses the onboarding forms).
export function ActivitiesSection({ rows, copy }: ActivitiesSectionProps) {
  return (
    <section aria-label={copy.activities} className="mt-10">
      <h2 className="display-title text-2xl">{copy.activities}</h2>
      <p className="text-sm opacity-75 mt-1 mb-4">{copy.activitiesLead}</p>
      <ul className="flex flex-col gap-3 list-none">
        {rows.map((row) => (
          <li key={row.section}>
            <Link
              href={`/config?section=${row.section}&from=overview`}
              className="min-h-[64px] flex items-center justify-between gap-3 px-5 py-3 rounded-card border-2 border-forest bg-white shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xs uppercase tracking-widest font-semibold opacity-60">
                  {row.label}
                </span>
                <span className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span
                    className={`font-semibold truncate ${
                      row.value ? "" : "opacity-50"
                    }`}
                  >
                    {row.value ?? copy.notSet}
                  </span>
                  {row.hint && (
                    <span
                      className={`text-xs font-mono shrink-0 ${
                        row.hintTone === "warn" ? "text-straw" : "text-clover"
                      }`}
                    >
                      {row.hint}
                    </span>
                  )}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold shrink-0">
                <Pencil className="w-4 h-4" aria-hidden />
                {copy.edit}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
