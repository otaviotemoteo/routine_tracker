import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { getAuditLookups, getDayChecksReadonly } from "@/db/queries";
import { getLang } from "@/lib/get-lang";
import { COPY, habitName } from "@/lib/i18n";
import { habitIcon } from "@/lib/icons";
import { describeDetails, type AuditBlock } from "@/lib/describe-details";
import { formatDayLong } from "@/lib/utils";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

interface DayAuditPageProps {
  params: Promise<{ date: string }>;
}

const sectionLabel =
  "text-[0.68rem] uppercase tracking-widest font-semibold opacity-55";

// Each detail shape gets the treatment that suits it, so a card is scannable
// rather than a wall of "label: value".
function Block({ block }: { block: AuditBlock }) {
  switch (block.kind) {
    case "row":
      return (
        <div className="flex items-baseline justify-between gap-4">
          <span className={sectionLabel}>{block.label}</span>
          <span className="font-semibold text-right">{block.value}</span>
        </div>
      );

    case "checklist":
      return (
        <div>
          <p className={`${sectionLabel} mb-1.5`}>{block.label}</p>
          <ul className="flex flex-col gap-1 list-none">
            {block.items.map((item, i) => (
              <li
                key={`${item.text}-${i}`}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="flex items-baseline gap-2 min-w-0">
                  <span
                    aria-hidden
                    className={item.done ? "text-clover" : "opacity-30"}
                  >
                    {item.done ? "✓" : "○"}
                  </span>
                  <span className={item.done ? "" : "opacity-50 line-through"}>
                    {item.text}
                  </span>
                </span>
                {item.meta && (
                  <span className="font-mono text-sm opacity-60 shrink-0">
                    {item.meta}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      );

    case "stack":
      return (
        <div>
          <p className={`${sectionLabel} mb-1`}>{block.label}</p>
          <p className="font-semibold">{block.value}</p>
        </div>
      );

    case "tiles":
      // Equal columns filling the row, however many there are.
      return (
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${block.items.length}, minmax(0, 1fr))`,
          }}
        >
          {block.items.map((tile) => (
            <div key={tile.label} className="bg-cream rounded-lg px-4 py-3">
              <p className={sectionLabel}>{tile.label}</p>
              <p
                className={`font-bold mt-0.5 ${
                  tile.mono ? "font-mono" : ""
                }`}
              >
                {tile.value}
              </p>
            </div>
          ))}
        </div>
      );

    case "list":
      return (
        <ul className="list-none -my-1">
          {block.items.map((item, i) => (
            <li
              key={`${item.label}-${i}`}
              className="flex items-center justify-between gap-3 py-2.5 border-t-2 border-sand first:border-t-0"
            >
              <span>{item.label}</span>
              <span
                className={`text-sm bg-cream rounded-full px-3 py-1 shrink-0 ${
                  item.mono ? "font-mono" : ""
                }`}
              >
                {item.value}
              </span>
            </li>
          ))}
        </ul>
      );

    case "chips":
      return (
        <div>
          <p className={`${sectionLabel} mb-1.5`}>{block.label}</p>
          <ul className="flex flex-wrap gap-1.5 list-none">
            {block.items.map((item, i) => (
              <li
                key={`${item}-${i}`}
                className="text-sm bg-cream border border-forest/15 rounded-full px-3 py-1"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      );

    case "rating":
      return (
        <div className="flex items-center justify-between gap-4">
          <span className={sectionLabel}>{block.label}</span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="flex gap-1">
              {Array.from({ length: block.max }, (_, i) => (
                <span
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i < block.value ? "bg-clover" : "bg-sand"
                  }`}
                />
              ))}
            </span>
            <span className="font-mono text-sm font-bold">
              {block.value}/{block.max}
            </span>
          </span>
        </div>
      );
  }
}

// The "what exactly did I do that day" screen — the visual twin of one `day`
// object from /api/export.
export default async function DayAuditPage({ params }: DayAuditPageProps) {
  const userId = await requireUserId();
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    notFound();
  }

  const lang = await getLang();
  const copy = COPY[lang];
  const [checks, lookups] = await Promise.all([
    getDayChecksReadonly(userId, date),
    getAuditLookups(userId),
  ]);
  const anyLogged = checks.some((c) => c.done || c.details || c.note);

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <p className="eyebrow">{copy.dayAudit.eyebrow}</p>
      <h1 className="display-title text-3xl sm:text-4xl mt-2 mb-4 flex items-center gap-3 first-letter:uppercase">
        <Link
          href="/overview?view=week"
          aria-label={copy.dayAudit.back}
          className="shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2"
        >
          <ArrowLeft className="w-7 h-7" aria-hidden />
        </Link>
        {formatDayLong(date, lang)}
      </h1>

      {!anyLogged ? (
        <p className="opacity-75 mt-4">{copy.dayAudit.noneLogged}</p>
      ) : (
        <ul className="flex flex-col gap-4 list-none">
          {checks.map((check) => {
            const Icon = habitIcon(check.templateKind, check.domainSlug);
            const name = habitName(lang, check.slug, check.name);
            const blocks = describeDetails(
              check.templateKind,
              check.details,
              lookups,
              copy.sheets,
              copy.today,
              { unit: check.unit, target: check.target }
            );
            return (
              <li
                key={check.id}
                className={`bg-white border-2 border-forest rounded-card shadow-hard ${
                  check.optional ? "border-dashed" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <Icon aria-hidden className="w-5 h-5 shrink-0" />
                    {name}
                  </span>
                  {check.done ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-clover bg-mint border border-clover/30 rounded-full px-2.5 py-0.5">
                      <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />
                      {copy.week.done}
                    </span>
                  ) : (
                    <span className="text-sm opacity-50">
                      {copy.dayAudit.notLogged}
                    </span>
                  )}
                </div>

                {(blocks.length > 0 || check.note) && (
                  <div className="border-t-2 border-sand px-5 py-4 flex flex-col gap-3">
                    {blocks.map((block, i) => {
                      // A summary line closing out a richer block (the effort
                      // after the exercises, the hard block after the chips)
                      // gets a rule above it; consecutive plain rows don't.
                      const prev = blocks[i - 1];
                      const divided =
                        prev !== undefined &&
                        (block.kind === "row" || block.kind === "rating") &&
                        prev.kind !== "row";
                      return (
                        <div
                          key={i}
                          className={
                            divided ? "border-t-2 border-sand pt-3" : undefined
                          }
                        >
                          <Block block={block} />
                        </div>
                      );
                    })}
                    {check.note && (
                      <p className="text-sm italic opacity-75 border-l-2 border-sand pl-3">
                        {check.note}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
