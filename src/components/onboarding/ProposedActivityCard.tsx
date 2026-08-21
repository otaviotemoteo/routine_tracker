import { X } from "lucide-react";
import { iconButton } from "@/components/ui/styles";
import { COPY, type Copy, type Lang } from "@/lib/i18n";
import type { ActivityRow } from "@/db/habits";

interface ProposedActivityCardProps {
  activity: ActivityRow;
  lang: Lang;
  copy: Copy["activities"];
  editHref: string;
  rejectAction: (formData: FormData) => void;
}

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null =>
  v && typeof v === "object" ? (v as Rec) : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// Screen 4 — one card per generated activity, its rich content shown with
// the face that matches the kind the model picked (activity-proposer.ts).
// Read-only preview: nothing here is editable in place — Editar goes to the
// same full page /config already uses (ActivityForm.tsx or one of the
// *Step.tsx forms), Excluir discards the proposal outright.
export function ProposedActivityCard({
  activity,
  lang,
  copy,
  editHref,
  rejectAction,
}: ProposedActivityCardProps) {
  const config = rec(activity.config);
  const badge = badgeFor(activity.templateKind, copy);

  return (
    <li className="relative border-2 border-forest rounded-card bg-white shadow-hard p-4 sm:p-5 flex flex-col gap-3.5">
      <div className="flex gap-3 pr-[84px]">
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[17px]">{activity.name}</span>
            <span className="font-mono text-[9.5px] font-bold tracking-widest text-clover bg-mint border-[1.5px] border-clover rounded-full px-2 py-0.5">
              {badge}
            </span>
          </div>
        </div>
        <div className="absolute top-4 right-4 flex gap-2">
          <a
            href={editHref}
            title={copy.reviewEdit}
            aria-label={`${copy.reviewEdit} ${activity.name}`}
            className={iconButton}
          >
            <PencilIcon />
          </a>
          <form action={rejectAction}>
            <input type="hidden" name="id" value={activity.id} />
            <button
              type="submit"
              aria-label={`${copy.reject} ${activity.name}`}
              className={iconButton}
            >
              <X className="w-4 h-4 text-[#a8452f]" aria-hidden />
            </button>
          </form>
        </div>
      </div>

      <div className="bg-sand/30 border-[1.5px] border-forest/15 rounded-2xl p-3.5 flex flex-col gap-2.5">
        <div className="font-mono text-[9.5px] font-bold tracking-widest text-forest/50">
          {FACE_LABEL[activity.templateKind ?? "plain"]?.(copy) ?? copy.faceMetricLabel}
        </div>

        {activity.templateKind === "treino" && (
          <TreinoFace config={config} lang={lang} />
        )}
        {activity.templateKind === "leitura" && <LeituraFace config={config} copy={copy} />}
        {activity.templateKind === "espiritualidade" && (
          <ContavelFace config={config} copy={copy} />
        )}
        {activity.templateKind === null && (
          <MetricaFace activity={activity} copy={copy} />
        )}
      </div>
    </li>
  );
}

// The small mono-caps pill next to the activity's name — TREINO/LEITURA/
// CONTÁVEL/MÉTRICA in the design. "espiritualidade" reads as "Contável" here
// specifically because that's the one shape this generator's output uses it
// for (see activity-proposer.ts) — the badge names the FACE, not the
// internal kind slug.
function badgeFor(templateKind: string | null, copy: Copy["activities"]): string {
  switch (templateKind) {
    case "treino":
      return copy.faceWorkout;
    case "leitura":
      return copy.faceReading;
    case "espiritualidade":
      return copy.faceCountable;
    default:
      return copy.faceMetric;
  }
}

const FACE_LABEL: Record<string, (c: Copy["activities"]) => string> = {
  treino: (c) => c.facePlanLabel,
  leitura: (c) => c.faceQueueLabel,
  espiritualidade: (c) => c.facePracticesLabel,
};

function PencilIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TreinoFace({ config, lang }: { config: Rec | null; lang: Lang }) {
  const weekdays = COPY[lang].onboarding.weekdays;
  const days = arr(config?.days) as {
    weekday: number;
    focus: string;
    exercises: { name: string }[];
  }[];
  return (
    <div className="flex flex-col gap-2">
      {days.map((day, i) => (
        <div key={i} className="flex gap-2.5 items-start">
          <span className="shrink-0 w-12 h-6 rounded-lg bg-mint border-[1.5px] border-forest flex items-center justify-center font-mono text-[10px] font-bold tracking-wide">
            {(weekdays[day.weekday - 1] ?? "").toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 flex flex-wrap gap-1.5">
            {day.exercises.map((ex, j) => (
              <span
                key={j}
                className="bg-white border-[1.5px] border-forest/20 rounded-full px-2.5 py-1 text-xs"
              >
                {ex.name}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LeituraFace({ config, copy }: { config: Rec | null; copy: Copy["activities"] }) {
  const target = typeof config?.targetBooksPerYear === "number" ? config.targetBooksPerYear : null;
  const books = arr(config?.books) as {
    title: string;
    totalPages: number;
    currentPage: number;
  }[];
  return (
    <div className="flex flex-col gap-2.5">
      {target !== null && (
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold">{target}</span>
          <span className="text-sm opacity-70">{copy.facePerYearLabel}</span>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {books.map((book, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="min-w-0 flex-1 truncate text-sm">{book.title}</span>
            <span className="shrink-0 font-mono text-xs text-forest/60">
              {book.totalPages} {copy.facePagesUnit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContavelFace({ config, copy }: { config: Rec | null; copy: Copy["activities"] }) {
  const practices = arr(config?.practices) as { name: string; countable: boolean }[];
  return (
    <div className="flex flex-col gap-2">
      {practices.map((p, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 bg-white border-[1.5px] border-forest/15 rounded-xl px-2.5 py-2"
        >
          <span className="min-w-0 flex-1 text-sm">{p.name}</span>
          <span
            className={`shrink-0 text-xs font-semibold ${p.countable ? "text-clover" : "opacity-40"}`}
          >
            {copy.faceCountableLabel}
          </span>
          <span
            className={`shrink-0 w-9 h-5 rounded-full border-[1.5px] border-forest flex items-center px-0.5 ${
              p.countable ? "bg-clover justify-end" : "bg-sand justify-start"
            }`}
            aria-hidden
          >
            <span className="w-3.5 h-3.5 rounded-full bg-white border-[1.5px] border-forest" />
          </span>
        </div>
      ))}
    </div>
  );
}

function MetricaFace({
  activity,
  copy,
}: {
  activity: ActivityRow;
  copy: Copy["activities"];
}) {
  const modes: { key: string; label: string }[] = [
    { key: "binary", label: copy.metricModeBinary },
    { key: "count", label: copy.metricModeCount },
    { key: "duration", label: copy.metricModeDuration },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-1.5">
        {modes.map((m) => {
          const active = m.key === activity.metricType;
          return (
            <span
              key={m.key}
              className={`flex-1 text-center rounded-full px-1 py-1.5 text-xs border-[1.5px] ${
                active
                  ? "border-forest bg-mint font-semibold"
                  : "border-forest/20 bg-white opacity-60"
              }`}
            >
              {m.label}
            </span>
          );
        })}
      </div>
      {activity.metricType !== "binary" && (
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold">{activity.target ?? "—"}</span>
          <span className="text-sm opacity-70">
            {activity.unit ?? ""}
            {activity.minimalAction ? ` · ${activity.minimalAction}` : ""}
          </span>
        </div>
      )}
      {activity.metricType === "binary" && activity.minimalAction && (
        <p className="text-sm opacity-70">{activity.minimalAction}</p>
      )}
    </div>
  );
}
