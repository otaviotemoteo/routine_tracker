import { notFound } from "next/navigation";
import { ActivitiesSection } from "@/components/ActivitiesSection";
import { HabitSummaryRow } from "@/components/habits/HabitSummaryRow";
import { DirectionsIndex } from "@/components/assessment/DirectionsIndex";
import { PreviewBoard } from "@/components/preview/PreviewBoard";
import { ASSESSMENT_COPY } from "@/lib/i18n-assessment";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import type { SetupRow } from "@/lib/setup-summary";
import type { ActivityWithHabit, HabitRow } from "@/db/habits";
import type { NarrativeRow } from "@/db/assessment";
import type { Finding } from "@/lib/diagnose";
import type { DomainSlug } from "@/lib/domains";

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

const habit = (over: Partial<ActivityWithHabit>): ActivityWithHabit =>
  ({
    id: 1,
    habitId: 1,
    habitName: "Leitura",
    name: "Leitura",
    slug: "leitura",
    optional: false,
    domainSlug: "education",
    metricType: "count",
    unit: "páginas",
    target: 10,
    minimalAction: "uma página",
    templateKind: "leitura",
    config: null,
    source: "human",
    why: null,
    activeFrom: "2026-07-21",
    activeTo: null,
    position: 1,
    ...over,
  }) as ActivityWithHabit;

export default async function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const lang = await getLang();
  const copy = COPY[lang];

  // Every row shape the Activities list can take, including the two that are
  // hard to produce on a real account: a section nobody has filled in, and one
  // carrying a warning rather than a count.
  const rows: SetupRow[] = [
    {
      activityId: 1,
      habitId: 1,
      habitName: "Cuidado com o corpo",
      templateKind: "treino",
      label: copy.onboarding.review.sections.workout,
      configured: true,
      value: "Treino A",
      meta: "5 dias de treino no plano",
    },
    {
      activityId: 2,
      habitId: 2,
      habitName: "Leitura",
      templateKind: "leitura",
      label: copy.onboarding.review.sections.reading,
      configured: true,
      value: "6 livros",
      hint: "Leia 9 páginas/dia para manter o ritmo",
      hintTone: "info",
    },
    {
      activityId: 3,
      habitId: 3,
      habitName: "Descanso",
      templateKind: "sono",
      label: copy.onboarding.review.sections.sleep,
      configured: true,
      value: "23:00 – 06:00",
      meta: "janela de 7h por noite",
    },
    {
      activityId: 4,
      habitId: 4,
      habitName: "Rotina",
      templateKind: "rotina",
      label: copy.onboarding.review.sections.routine,
      configured: true,
      value: "Academia, Banho e café, Leitura",
      meta: "6 blocos no dia",
    },
    {
      activityId: 5,
      habitId: 5,
      habitName: "Idiomas",
      templateKind: "duolingo",
      label: copy.onboarding.review.sections.duolingo,
      configured: true,
      value: "Inglês, Francês, Espanhol, Alemão",
      hint: "Faltam 2 livros",
      hintTone: "warn",
    },
    {
      activityId: 6,
      habitId: 6,
      habitName: "Espiritualidade",
      templateKind: "espiritualidade",
      label: copy.onboarding.review.sections.spirituality,
      configured: false,
      value: null,
    },
  ];

  // Screen 1 — Direções: five domains, real narratives, a finding or two each
  // (drives the badges — DirectionsIndex reuses PriorityList's own copy.
  // patterns lookup, so these need to be real Pattern values, not invented
  // strings).
  const DIRECTIONS_PRIORITY: DomainSlug[] = [
    "community",
    "couple",
    "friends",
    "art",
    "spirituality",
  ];
  const directionsWritten: Record<string, NarrativeRow> = {
    community: {
      id: 1,
      domainSlug: "community",
      rawReflection: "",
      narrative:
        "Quero estar presente no bairro onde moro, não só de passagem — uma coisa por mês que envolva outras pessoas.",
    },
    couple: {
      id: 2,
      domainSlug: "couple",
      rawReflection: "",
      narrative:
        "Quero um tempo com a Marina que não seja o resto do dia: sem telefone, sem resolver pendência.",
    },
    friends: {
      id: 3,
      domainSlug: "friends",
      rawReflection: "",
      narrative:
        "Quero manter contato com quem mora longe antes que vire aquela mensagem de aniversário uma vez por ano.",
    },
    art: {
      id: 4,
      domainSlug: "art",
      rawReflection: "",
      narrative:
        "Quero voltar a tocar sem cobrança de virar bom nisso — o violão parado no canto me incomoda.",
    },
  };
  const directionsFindings: Finding[] = [
    { domainSlug: "community", pattern: "LIVING_GAP", severity: 0.8, evidence: {} },
    { domainSlug: "couple", pattern: "POSTPONED", severity: 0.5, evidence: {} },
    { domainSlug: "friends", pattern: "LIVING_GAP", severity: 0.7, evidence: {} },
    { domainSlug: "art", pattern: "HOPELESSNESS", severity: 0.9, evidence: {} },
  ];

  // Screen 2 — Hábitos: one proposed habit per direction above, still
  // active_from NULL in spirit (this is a review screen, before "Start
  // tracking").
  const proposedHabits: HabitRow[] = [
    {
      id: 1,
      name: "Aparecer no bairro",
      slug: "aparecer-bairro",
      icon: null,
      optional: false,
      domainId: 1,
      domainSlug: "community",
      source: "ai_suggested",
      why: "Participar de algo coletivo perto de casa, sem precisar organizar nada.",
      activeFrom: null,
      activeTo: null,
      position: 0,
    },
    {
      id: 2,
      name: "Tempo sem tela a dois",
      slug: "tempo-sem-tela",
      icon: null,
      optional: false,
      domainId: 2,
      domainSlug: "couple",
      source: "ai_suggested",
      why: "Um período do dia reservado, com o celular longe.",
      activeFrom: null,
      activeTo: null,
      position: 1,
    },
    {
      id: 3,
      name: "Ligar para um amigo",
      slug: "ligar-amigo",
      icon: null,
      optional: false,
      domainId: 3,
      domainSlug: "friends",
      source: "ai_edited",
      why: "Uma ligação de verdade por semana, mesmo que curta.",
      activeFrom: null,
      activeTo: null,
      position: 2,
    },
    {
      id: 4,
      name: "Tocar violão",
      slug: "tocar-violao",
      icon: null,
      optional: false,
      domainId: 4,
      domainSlug: "art",
      source: "human",
      why: null,
      activeFrom: null,
      activeTo: null,
      position: 3,
    },
  ];

  const habits: ActivityWithHabit[] = [
    habit({ id: 1 }),
    habit({
      id: 2,
      habitId: 2,
      habitName: "Treino",
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
      habitId: 3,
      habitName: "Ler o salmo do dia",
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

      <Block title="Tela 1 — Direções (revisão)">
        <DirectionsIndex
          priority={DIRECTIONS_PRIORITY}
          written={directionsWritten}
          findings={directionsFindings}
          copy={ASSESSMENT_COPY[lang]}
        />
      </Block>

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
      <PreviewBoard lang={lang} habits={habits} proposedHabits={proposedHabits} />
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
