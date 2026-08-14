import { notFound } from "next/navigation";
import { ActivitiesSection } from "@/components/ActivitiesSection";
import { HabitSummaryRow } from "@/components/habits/HabitSummaryRow";
import { PreviewBoard } from "@/components/preview/PreviewBoard";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import type { SetupRow } from "@/lib/setup-summary";
import type { HabitRow } from "@/db/habits";

// A workbench for the redesign — every reworked component on one screen, with
// invented data, reading from nothing.
//
// It exists because the loop for judging a visual change was commit → deploy →
// look → ask for another change, which is slow enough that it discourages
// saying "that's not right yet". Here the whole set is one `bun run dev` away
// and every state is on screen at once, including the ones that are awkward to
// reach for real (a section nobody configured, a habit with no streak, a row
// mid-confirmation).
//
// Never ships: it 404s outside development. It is a tool, not a feature, and a
// route rendering fake habits is the last thing that should be reachable in
// production.
export const dynamic = "force-dynamic";

const habit = (over: Partial<HabitRow>): HabitRow =>
  ({
    id: 1,
    name: "Leitura",
    slug: "leitura",
    icon: null,
    optional: false,
    domainSlug: "education",
    metricType: "count",
    unit: "páginas",
    target: 10,
    minimalAction: "uma página",
    templateKind: "leitura",
    source: "human",
    why: null,
    activeFrom: "2026-07-21",
    activeTo: null,
    position: 1,
    ...over,
  }) as HabitRow;

export default async function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const lang = await getLang();
  const copy = COPY[lang];

  // Every row shape the Activities list can take, including the two that are
  // hard to produce on a real account: a section nobody has filled in, and one
  // carrying a warning rather than a count.
  const rows: SetupRow[] = [
    {
      section: "workout",
      label: copy.onboarding.review.sections.workout,
      configured: true,
      value: "Treino A",
      meta: "5 dias de treino no plano",
    },
    {
      section: "reading",
      label: copy.onboarding.review.sections.reading,
      configured: true,
      value: "6 livros",
      hint: "Leia 9 páginas/dia para manter o ritmo",
      hintTone: "info",
    },
    {
      section: "sleep",
      label: copy.onboarding.review.sections.sleep,
      configured: true,
      value: "23:00 – 06:00",
      meta: "janela de 7h por noite",
    },
    {
      section: "routine",
      label: copy.onboarding.review.sections.routine,
      configured: true,
      value: "Academia, Banho e café, Leitura",
      meta: "6 blocos no dia",
    },
    {
      section: "duolingo",
      label: copy.onboarding.review.sections.duolingo,
      configured: true,
      value: "Inglês, Francês, Espanhol, Alemão",
      hint: "Faltam 2 livros",
      hintTone: "warn",
    },
    {
      section: "spirituality",
      label: copy.onboarding.review.sections.spirituality,
      configured: false,
      value: null,
    },
  ];

  const habits: HabitRow[] = [
    habit({ id: 1 }),
    habit({
      id: 2,
      name: "Treino",
      slug: "treino",
      metricType: "binary",
      unit: null,
      target: null,
      minimalAction: "Um exercício",
      templateKind: "treino",
      domainSlug: "health",
    }),
    habit({
      id: 3,
      name: "Ler o salmo do dia",
      slug: "salmo",
      metricType: "binary",
      unit: null,
      target: null,
      minimalAction: "Um versículo",
      templateKind: null,
      domainSlug: null,
      source: "ai_suggested",
      why: "Sua direção fala em retomar a oração diária.",
    }),
  ];

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <p className="eyebrow">Preview</p>
      <h1 className="display-title text-4xl mt-1">Redesign</h1>
      <p className="mt-2 opacity-75">
        Dados falsos. Esta rota não existe em produção.
      </p>

      <Block title="Atividades — lista agrupada">
        <ActivitiesSection
          rows={rows}
          copy={copy.today}
          readingCopy={copy.onboarding.reading}
        />
      </Block>

      <Block title="Hábitos — linha resumida (Overview)">
        <ul className="flex flex-col gap-2.5 list-none">
          {habits.map((h, i) => (
            <HabitSummaryRow
              key={h.id}
              habit={h}
              lang={lang}
              copy={copy.habits}
              streak={i === 0 ? 4 : undefined}
            />
          ))}
        </ul>
      </Block>

      {/* The interactive half lives in a client island: the accordion states,
          the inline confirmation and the live sleep window only mean anything
          when you can press them. */}
      <PreviewBoard lang={lang} habits={habits} />
    </main>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-mono text-[10px] font-bold tracking-widest opacity-50 border-b-2 border-dashed border-sand pb-2 mb-4">
        {title.toUpperCase()}
      </h2>
      {children}
    </section>
  );
}
