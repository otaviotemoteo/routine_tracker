import { HabitRow } from "./HabitRow";
import { domainIcon } from "@/lib/domain-icons";
import { isDomainSlug, DOMAIN_SLUGS, type DomainSlug } from "@/lib/domains";
import { ASSESSMENT_COPY } from "@/lib/i18n-assessment";
import type { Copy, Lang } from "@/lib/i18n";
import type { ActivityWithHabit } from "@/db/habits";

interface HabitGroupsProps {
  activities: ActivityWithHabit[];
  lang: Lang;
  copy: Copy["habits"];
  removeAction: (formData: FormData) => void;
  editHrefFor: (id: number) => string;
  next: string;
  showSource?: boolean;
  // Per activity id. Absent on the review screen, where nothing has been
  // tracked yet and every figure would be a zero.
  streaks?: Record<number, number>;
}

// Activities grouped by life area, in the fixed domain order — the same order
// the assessment asks them in, so the two screens never disagree about where
// an area sits. Activities with no area come last under their own heading
// rather than being hidden: "not yet anchored to a value" is useful data.
export function HabitGroups({
  activities,
  lang,
  copy,
  removeAction,
  editHrefFor,
  next,
  showSource = false,
  streaks,
}: HabitGroupsProps) {
  const byDomain = new Map<DomainSlug, ActivityWithHabit[]>();
  const unanchored: ActivityWithHabit[] = [];
  for (const activity of activities) {
    if (activity.domainSlug && isDomainSlug(activity.domainSlug)) {
      const list = byDomain.get(activity.domainSlug) ?? [];
      list.push(activity);
      byDomain.set(activity.domainSlug, list);
    } else {
      unanchored.push(activity);
    }
  }

  const groups: { key: string; label: string; icon: React.ReactNode; items: ActivityWithHabit[] }[] =
    [];
  for (const slug of DOMAIN_SLUGS) {
    const items = byDomain.get(slug);
    if (!items?.length) continue;
    const Icon = domainIcon(slug);
    groups.push({
      key: slug,
      label: ASSESSMENT_COPY[lang].domains[slug].name,
      icon: <Icon className="w-4 h-4" aria-hidden />,
      items,
    });
  }
  if (unanchored.length) {
    groups.push({
      key: "none",
      label: copy.unanchored,
      icon: null,
      items: unanchored,
    });
  }

  return (
    <div className="flex flex-col gap-7">
      {groups.map((group) => (
        <section key={group.key}>
          <h2 className="eyebrow flex items-center gap-2 mb-2.5">
            {group.icon}
            {group.label}
          </h2>
          <ul className="flex flex-col gap-3 list-none">
            {group.items.map((activity) => (
              <HabitRow
                key={activity.id}
                activity={activity}
                copy={copy}
                editHref={editHrefFor(activity.id)}
                removeAction={removeAction}
                next={next}
                showSource={showSource}
                streak={streaks?.[activity.id]}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
