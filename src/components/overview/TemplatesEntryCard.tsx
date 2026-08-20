import Link from "next/link";
import { LayoutTemplate, ChevronRight } from "lucide-react";
import { listTrackedActivities } from "@/db/habits";
import { format, type Copy } from "@/lib/i18n";
import { isChoosableTemplateKind, isGenericTemplateKind } from "@/lib/templates";
import type { UserId } from "@/db/scope";

// The one entry point into the card-style chooser from Overview — same row
// shape as ActivitiesSection's own rows (border-2, shadow-hard, an icon and a
// two-line label/value stack), but kept as its own small component rather
// than folded into ActivitiesSection: that component's `SetupRow` type is
// shared by three screens and always links to /config?section=, and this row
// links somewhere else entirely and only ever appears here.
export async function TemplatesEntryCard({
  userId,
  copy,
}: {
  userId: UserId;
  copy: Copy["today"];
}) {
  const activities = await listTrackedActivities(userId);
  const eligible = activities.filter((h) => isChoosableTemplateKind(h.templateKind));
  if (eligible.length === 0) return null;
  const chosen = eligible.filter((h) => isGenericTemplateKind(h.templateKind)).length;

  return (
    <Link
      href="/habits/templates?from=overview"
      className="mt-3 min-h-[74px] flex items-center gap-3 px-4 py-3 rounded-card border-2 border-forest shadow-hard bg-white"
    >
      <LayoutTemplate className="w-[18px] h-[18px] shrink-0 text-clover" aria-hidden />
      <span className="min-w-0 flex-1 flex flex-col gap-0.5">
        <span className="font-semibold">{copy.templatesEntryLabel}</span>
        <span className="text-sm opacity-70">
          {format(copy.templatesEntryValue, { done: chosen, total: eligible.length })}
        </span>
      </span>
      <ChevronRight className="w-[18px] h-[18px] shrink-0 opacity-40" aria-hidden />
    </Link>
  );
}
