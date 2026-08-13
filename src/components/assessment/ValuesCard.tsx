import type { UserId } from "@/db/scope";
import Link from "next/link";
import { cardSurface, primaryButton } from "@/components/ui/styles";
import { domainIcon } from "@/lib/domain-icons";
import { ScoreBar } from "./ScoreBar";
import { getLatestSealed, getOpenDraft } from "@/db/assessment";
import { rankByGap } from "@/lib/diagnose";
import { answeredCount } from "@/lib/assessment";
import { TOTAL_DOMAINS } from "@/lib/domains";
import { format, type Copy, type Lang } from "@/lib/i18n";
import { formatShortDayMonth } from "@/lib/utils";

interface ValuesCardProps {
  userId: UserId;
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

  // The three areas the check-in put at the top, as a reminder of what it
  // said. "Widest distances" was the old label and it named a number nobody
  // could act on; these are simply the areas that matter.
  const top = rankByGap(sealed.ratings)
    .filter((row) => row.gap > 0)
    .slice(0, 3);

  return (
    <Frame eyebrow={copy.card.eyebrow} title={copy.card.doneTitle}>
      <p className="mt-1.5 text-sm opacity-80">{copy.card.doneSubtitle}</p>
      <p className="mt-2 font-mono text-xs opacity-60">
        {format(copy.card.doneLead, {
          date: formatShortDayMonth(sealed.takenAt, lang),
        })}
      </p>

      {top.length > 0 && (
        <>
          <p className="mt-5 font-semibold text-sm">{copy.card.relevantAreas}</p>
          <ul className="flex flex-col mt-2 list-none">
            {top.map((row, i) => {
              const Icon = domainIcon(row.domainSlug);
              return (
                <li
                  key={row.domainSlug}
                  className={
                    i === 0
                      ? "py-2"
                      : "py-2 border-t-2 border-dashed border-sand"
                  }
                >
                  {/* Every bar here measures the same thing, so naming the
                      scale on each row is a word repeated three times. The
                      area goes in that slot instead, on the bar's own line. */}
                  <ScoreBar
                    labelWidth="w-28"
                    label={
                      <span className="flex items-center gap-1.5 min-w-0 text-forest">
                        <Icon className="w-3.5 h-3.5 shrink-0 opacity-60" aria-hidden />
                        <span className="font-semibold truncate">
                          {copy.domains[row.domainSlug].name}
                        </span>
                      </span>
                    }
                    value={row.importanceGeneral}
                    valueLabel={format(copy.results.scoreOutOf, {
                      n: row.importanceGeneral,
                    })}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Link href="/assessment/results" className={`${primaryButton} mt-5`}>
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
    <section className={`${cardSurface} mt-10 p-5`}>
      <p className="eyebrow mb-2">{eyebrow}</p>
      <h2 className="display-title text-2xl">{title}</h2>
      {children}
    </section>
  );
}
