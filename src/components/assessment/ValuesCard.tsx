import Link from "next/link";
import { ghostButton, primaryButton } from "@/components/ui/styles";
import { getLatestSealed, getOpenDraft } from "@/db/assessment";
import { rankByGap } from "@/lib/diagnose";
import { answeredCount } from "@/lib/assessment";
import { TOTAL_DOMAINS } from "@/lib/domains";
import { format, type Copy, type Lang } from "@/lib/i18n";
import { formatShortDayMonth } from "@/lib/utils";

interface ValuesCardProps {
  userId: number;
  lang: Lang;
  copy: Copy["assessment"];
}

// The way into the values check-in.
//
// It lives on Overview rather than in the nav bar: the nav holds two items
// plus language plus logout and is already three controls wide on a phone, and
// a permanent slot for something touched twice a year is the wrong weight.
// Overview is already the "how am I doing over time" screen, and this is that
// at a different timescale.
//
// Three states, each naming what the button will actually do.
export async function ValuesCard({ userId, lang, copy }: ValuesCardProps) {
  const draft = await getOpenDraft(userId);

  if (draft) {
    const done = answeredCount(draft.ratings);
    return (
      <Frame eyebrow={copy.card.eyebrow} title={copy.card.draftTitle}>
        <p className="mt-2 text-sm opacity-75">
          {format(copy.card.draftLead, {
            date: formatShortDayMonth(draft.takenAt, lang),
            done,
            total: TOTAL_DOMAINS,
          })}
        </p>
        {/* The bar is the same one the flow itself uses, so picking it back up
            looks like returning rather than restarting. */}
        <div
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={TOTAL_DOMAINS}
          aria-label={copy.card.draftTitle}
          className="h-3 border-2 border-forest rounded-full bg-sand overflow-hidden mt-3"
        >
          <div
            className="h-full bg-clover"
            style={{ width: `${(done / TOTAL_DOMAINS) * 100}%` }}
          />
        </div>
        <Link href="/assessment" className={`${primaryButton} mt-4`}>
          {copy.card.draftAction}
        </Link>
      </Frame>
    );
  }

  const sealed = await getLatestSealed(userId);

  if (!sealed) {
    return (
      <Frame eyebrow={copy.card.eyebrow} title={copy.card.emptyTitle}>
        <p className="mt-2 text-sm opacity-75">{copy.card.emptyLead}</p>
        <Link href="/assessment" className={`${primaryButton} mt-4`}>
          {copy.card.emptyAction}
        </Link>
      </Frame>
    );
  }

  // The three widest distances, as a reminder of what the last check-in said.
  const top = rankByGap(sealed.ratings)
    .filter((row) => row.gap > 0)
    .slice(0, 3);

  return (
    <Frame eyebrow={copy.card.eyebrow} title={copy.card.doneTitle}>
      <p className="mt-2 text-sm opacity-75">
        {format(copy.card.doneLead, {
          date: formatShortDayMonth(sealed.takenAt, lang),
        })}
      </p>

      {top.length > 0 && (
        <>
          <p className="mt-4 font-semibold text-sm">{copy.card.biggestGaps}</p>
          <ul className="flex flex-col gap-1.5 mt-2 list-none">
            {top.map((row) => (
              <li
                key={row.domainSlug}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span>{copy.domains[row.domainSlug].name}</span>
                <span className="font-mono text-xs opacity-70">
                  {format(copy.results.gapLabel, { n: row.gap })}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Link href="/assessment/results" className={`${ghostButton} mt-4`}>
        {copy.card.doneAction}
      </Link>
    </Frame>
  );
}

function Frame({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 border-2 border-forest rounded-card bg-white shadow-hard p-5">
      <p className="eyebrow mb-2">{eyebrow}</p>
      <h2 className="display-title text-2xl">{title}</h2>
      {children}
    </section>
  );
}
