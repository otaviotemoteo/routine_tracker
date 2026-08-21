"use client";

import { HabitRow as HabitRowCard } from "@/components/habits/HabitRow";
import { ProposedHabitGroups } from "@/components/habits/ProposedHabitGroups";
import { ActivityBriefingForm } from "@/components/onboarding/ActivityBriefingForm";
import { ProposedActivityCard } from "@/components/onboarding/ProposedActivityCard";
import { WorkoutStep } from "@/components/onboarding/WorkoutStep";
import { ReadingStep } from "@/components/onboarding/ReadingStep";
import { RoutineStep } from "@/components/onboarding/RoutineStep";
import { SleepStep } from "@/components/onboarding/SleepStep";
import { COPY, type Lang } from "@/lib/i18n";
import type { ActivityRow, ActivityWithHabit, HabitRow } from "@/db/habits";

// The half of the preview that has to be pressed to be judged.
//
// Treino/Leitura/Rotina/Sono below render the REAL /config edit forms
// (WorkoutStep/ReadingStep/RoutineStep/SleepStep), fed mock initial data and
// an inert no-op action — not a separate, hand-rolled approximation. This
// gallery's whole point is that what you see here is what actually renders
// when you go edit an activity; a lookalike mock would drift from that and
// lie about it (see this file's own header history — it used to be one).

// Screen 4's four faces — one ActivityRow per proposable kind, real
// config-schemas.ts shapes (ProposedActivityCard reads them directly, no
// looser preview-only shape).
const proposedActivity = (over: Partial<ActivityRow>): ActivityRow =>
  ({
    id: 1,
    habitId: 1,
    name: "Treino de força",
    slug: "treino-forca",
    metricType: "binary",
    unit: null,
    target: null,
    minimalAction: null,
    templateKind: "treino",
    config: null,
    source: "ai_suggested",
    why: null,
    activeFrom: null,
    activeTo: null,
    position: 0,
    ...over,
  }) as ActivityRow;

const PROPOSED_ACTIVITIES: ActivityRow[] = [
  proposedActivity({
    id: 1,
    name: "Treino de força",
    templateKind: "treino",
    config: {
      planName: "Full body 3x",
      days: [
        {
          id: 1,
          weekday: 1,
          focus: "Peito e ombro",
          exercises: [
            { name: "Agachamento", sets: 3, reps: 10 },
            { name: "Remada", sets: 3, reps: 12 },
            { name: "Prancha", sets: 3, seconds: 40, kind: "time" },
          ],
          active: true,
        },
        {
          id: 2,
          weekday: 3,
          focus: "Costas e trapézio",
          exercises: [
            { name: "Supino", sets: 3, reps: 10 },
            { name: "Puxada", sets: 3, reps: 12 },
          ],
          active: true,
        },
      ],
    },
  }),
  proposedActivity({
    id: 2,
    name: "Leitura da noite",
    templateKind: "leitura",
    config: {
      year: 2026,
      targetBooksPerYear: 3,
      books: [
        { id: 1, title: "Imitação de Cristo", author: null, totalPages: 464, currentPage: 169, status: "reading", position: 0, startedAt: null, finishedAt: null },
        { id: 2, title: "O cavaleiro preso na armadura", author: null, totalPages: 110, currentPage: 0, status: "queued", position: 1, startedAt: null, finishedAt: null },
        { id: 3, title: "O apagamento", author: null, totalPages: 301, currentPage: 0, status: "queued", position: 2, startedAt: null, finishedAt: null },
      ],
    },
  }),
  proposedActivity({
    id: 3,
    name: "Práticas da manhã",
    templateKind: "espiritualidade",
    config: {
      practices: [
        { slug: "oracao", name: "Oração", countable: true, position: 0, active: true },
        { slug: "terco", name: "Terço", countable: true, position: 1, active: true },
        { slug: "leitura-biblica", name: "Leitura bíblica", countable: false, position: 2, active: true },
      ],
    },
  }),
  proposedActivity({
    id: 4,
    name: "Ligar para um amigo",
    templateKind: null,
    config: null,
    metricType: "binary",
    minimalAction: "Uma ligação por semana",
  }),
];

export function PreviewBoard({
  lang,
  activities,
  proposedHabits,
}: {
  lang: Lang;
  activities: ActivityWithHabit[];
  proposedHabits: HabitRow[];
}) {
  const copy = COPY[lang];

  return (
    <>
      {/* ProposedHabitGroups renders ProposedHabitRow, which is a Client
          Component (needs the remove-confirm dialog's own state) — it has
          to be mounted from inside this client island, not from the server
          page.tsx, or a plain closure passed as removeAction/editHrefFor
          crosses the server/client boundary illegally. */}
      <Block title="Tela 2 — Hábitos (revisão)">
        <ProposedHabitGroups
          habits={proposedHabits}
          lang={lang}
          copy={copy.habits}
          removeAction={() => {}}
          editHrefFor={() => "#"}
          next="#"
          showSource
        />
      </Block>

      <Block title="Tela 3 — Briefing">
        <ActivityBriefingForm
          habits={proposedHabits}
          lang={lang}
          copy={copy.activities}
          action={() => {}}
        />
      </Block>

      <Block title="Tela 4 — Atividades sugeridas (quatro faces)">
        <ul className="flex flex-col gap-3.5 list-none">
          {PROPOSED_ACTIVITIES.map((activity) => (
            <ProposedActivityCard
              key={activity.id}
              activity={activity}
              lang={lang}
              copy={copy.activities}
              editHref="#"
              rejectAction={() => {}}
            />
          ))}
        </ul>
      </Block>

      <Block title="Hábitos — linha completa (/habits)">
        <ul className="flex flex-col gap-2.5 list-none">
          {activities.map((a, i) => (
            <HabitRowCard
              key={a.id}
              activity={a}
              copy={copy.habits}
              editHref="#"
              removeAction={() => {}}
              next="#"
              showSource
              streak={i === 0 ? 4 : undefined}
            />
          ))}
        </ul>
      </Block>

      <Block title="Treino — /config's real form (WorkoutStep)">
        <WorkoutStep
          action={async () => {}}
          next="#"
          submitLabel={copy.onboarding.save}
          copy={copy.onboarding}
          initialName="Full body 3x"
          initialDays={[
            {
              weekday: 1,
              focus: "Peito e ombro",
              exercises: [
                { name: "Agachamento", kind: "reps", sets: 3, reps: 10 },
                { name: "Remada", kind: "reps", sets: 3, reps: 12 },
                { name: "Prancha", kind: "time", sets: 3, seconds: 40 },
              ],
            },
            {
              weekday: 3,
              focus: "Costas e trapézio",
              exercises: [
                { name: "Supino", kind: "reps", sets: 3, reps: 10 },
                { name: "Puxada", kind: "reps", sets: 3, reps: 12 },
              ],
            },
          ]}
        />
      </Block>

      <Block title="Leitura — /config's real form (ReadingStep)">
        <ReadingStep
          action={async () => {}}
          next="#"
          submitLabel={copy.onboarding.save}
          copy={copy.onboarding}
          initialGoal="3"
          initialBooks={[
            {
              id: 1,
              title: "Imitação de Cristo",
              author: "Tomás de Kempis",
              pages: "464",
              currentPage: "169",
              reading: true,
            },
            {
              id: 2,
              title: "O cavaleiro preso na armadura",
              author: "",
              pages: "110",
              currentPage: "0",
              reading: false,
            },
            {
              id: 3,
              title: "O apagamento",
              author: "",
              pages: "301",
              currentPage: "0",
              reading: false,
            },
          ]}
          daysLeft={130}
          year={2026}
        />
      </Block>

      <Block title="Rotina — /config's real form (RoutineStep)">
        <RoutineStep
          action={async () => {}}
          next="#"
          submitLabel={copy.onboarding.save}
          copy={copy.onboarding}
          initialBlocks={[
            { startTime: "06:00", endTime: "07:00", activity: "Academia", weekdays: [1, 2, 3, 4, 5] },
            { startTime: "07:15", endTime: "07:45", activity: "Banho e café", weekdays: [1, 2, 3, 4, 5] },
          ]}
        />
      </Block>

      <Block title="Sono — /config's real form (SleepStep)">
        <SleepStep
          action={async () => {}}
          next="#"
          submitLabel={copy.onboarding.save}
          copy={copy.onboarding}
          initialBedtime="23:00"
          initialWake="06:00"
          averageHours={6.67}
        />
      </Block>
    </>
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
