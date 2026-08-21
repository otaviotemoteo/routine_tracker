"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { HabitRow as HabitRowCard } from "@/components/habits/HabitRow";
import { ProposedHabitGroups } from "@/components/habits/ProposedHabitGroups";
import { ActivityBriefingForm } from "@/components/onboarding/ActivityBriefingForm";
import { ProposedActivityCard } from "@/components/onboarding/ProposedActivityCard";
import { ListCard } from "@/components/onboarding/ListCard";
import { SetupPanel } from "@/components/onboarding/SetupPanel";
import { inputClass } from "@/components/ui/styles";
import { COPY, format, type Copy, type Lang } from "@/lib/i18n";
import type { ActivityRow, ActivityWithHabit, HabitRow } from "@/db/habits";

// The half of the preview that has to be pressed to be judged.
//
// A screenshot of an accordion tells you nothing about whether opening it
// feels right, and the inline remove confirmation is invisible until you ask
// for it — so both are here, live, with the confirmation reachable in one tap
// rather than by deleting something real.
//
// Every entry starts OPEN and IN EDIT, because the form is the part that most
// needs looking at and making it cost two clicks meant it was the one state
// nobody checked.

// ─── Shared field styles ─────────────────────────────────────────────────────
// Smaller than the app's standard input: these sit several-to-a-row inside an
// already-nested card, where the full 44px control would not fit a phone.
const cell =
  "min-h-[40px] px-2.5 rounded-lg border-2 border-forest bg-cream focus:bg-white";
const num = `${cell} font-mono text-sm text-center px-1`;

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
  habits,
  proposedHabits,
}: {
  lang: Lang;
  habits: ActivityWithHabit[];
  proposedHabits: HabitRow[];
}) {
  const copy = COPY[lang];
  const [bedtime, setBedtime] = useState("23:00");
  const [wake, setWake] = useState("06:00");

  const mins = (t: string) => {
    const [h, m] = t.slice(0, 5).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const hours = Math.round(
    ((((mins(wake) - mins(bedtime)) % 1440) + 1440) % 1440) / 60
  );

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
          {habits.map((h, i) => (
            <HabitRowCard
              key={h.id}
              habit={h}
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

      <Block title="Treino — exercício numa linha só">
        <Accordion
          copy={copy}
          entries={[
            { badge: "Seg", title: "Peito + Ombro", chips: ["5 EXERCÍCIOS", "18 SÉRIES"] },
            { badge: "Ter", title: "Costas + Trapézio", chips: ["5 EXERCÍCIOS", "18 SÉRIES"] },
          ]}
          renderForm={(e) => <DayForm badge={e.badge} focus={e.title} copy={copy} />}
        />
      </Block>

      <Block title="Leitura — título, autor + páginas, lendo agora">
        <Accordion
          copy={copy}
          entries={[
            { badge: "1", title: "Imitação de Cristo", chips: ["LENDO · 160/464"] },
            { badge: "2", title: "O cavaleiro preso na armadura", chips: ["110 P"] },
          ]}
          renderForm={(e) => <BookForm title={e.title} />}
        />
      </Block>

      <Block title="Rotina — nome primeiro, depois horário e dias">
        <Accordion
          copy={copy}
          entries={[
            { badge: "06:00", title: "Academia", chips: ["SEG A SEX", "1H"] },
            { badge: "07:15", title: "Banho e café", chips: ["SEG A SEX", "30 MIN"] },
          ]}
          renderForm={(e) => <BlockForm name={e.title} copy={copy} />}
        />
      </Block>

      <Block title="Sono — já aprovado">
        <SetupPanel
          label={copy.onboarding.sleep.targetLabel}
          lead={copy.onboarding.sleep.targetLead}
        >
          <div className="flex items-end gap-2.5 flex-wrap">
            <div className="min-w-0 flex-1">
              <label className="block mb-1.5 font-semibold text-sm">
                {copy.onboarding.sleep.bedtime}
              </label>
              <input
                type="time"
                value={bedtime}
                onChange={(e) => setBedtime(e.target.value)}
                className={`${inputClass} font-mono w-full`}
              />
            </div>
            <span aria-hidden className="h-[46px] flex items-center opacity-40">
              —
            </span>
            <div className="min-w-0 flex-1">
              <label className="block mb-1.5 font-semibold text-sm">
                {copy.onboarding.sleep.wake}
              </label>
              <input
                type="time"
                value={wake}
                onChange={(e) => setWake(e.target.value)}
                className={`${inputClass} font-mono w-full`}
              />
            </div>
          </div>
          <div className="mt-3 bg-mint rounded-lg px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <span className="font-semibold text-sm">
              {format(copy.onboarding.sleep.window, { n: hours })}
            </span>
            <span className="font-mono text-[11px] font-bold opacity-60">
              {format(copy.onboarding.sleep.average, { v: "6h40" })}
            </span>
          </div>
        </SetupPanel>
      </Block>
    </>
  );
}

// ─── The accordion wrapper the three lists share ─────────────────────────────

interface Entry {
  badge: string;
  title: string;
  chips: string[];
}

function Accordion({
  copy,
  entries,
  renderForm,
}: {
  copy: Copy;
  entries: Entry[];
  renderForm: (e: Entry) => React.ReactNode;
}) {
  const [open, setOpen] = useState<number | null>(0);
  const [editing, setEditing] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-2.5">
      {entries.map((e, i) => (
        <ListCard
          key={e.badge}
          title={e.title}
          badge={e.badge}
          chips={e.chips.map((text, k) => ({
            text,
            tone: k === 0 ? ("count" as const) : ("muted" as const),
          }))}
          open={open === i}
          onToggle={() => {
            setOpen(open === i ? null : i);
            setEditing(null);
          }}
          toggleLabel={copy.onboarding.workout.viewDay}
          editing={editing === i}
          onEdit={() => setEditing(i)}
          editLabel={copy.onboarding.config.edit}
          onRemove={() => {}}
          removeLabel={copy.onboarding.workout.removeDay}
          removeConfirm={format(copy.onboarding.confirmRemove, { name: e.title })}
          removeWarning={copy.onboarding.confirmWarning}
          removeCancel={copy.onboarding.confirmCancel}
          removeGo={copy.onboarding.confirmGo}
          read={<p className="text-sm opacity-70">{e.chips.join(" · ")}</p>}
        >
          {renderForm(e)}
        </ListCard>
      ))}
    </div>
  );
}

// ─── Training day ────────────────────────────────────────────────────────────

// One exercise, one line: index, name, sets × reps, unit, remove. It wraps
// only below 640px, where six controls genuinely cannot share a row without
// something going under the touch minimum.
function DayForm({
  badge,
  focus,
  copy,
}: {
  badge: string;
  focus: string;
  copy: Copy;
}) {
  const [rows, setRows] = useState([
    { name: "Supino reto com halteres", sets: 4, reps: 10 },
    { name: "Supino inclinado na máquina", sets: 4, reps: 10 },
    { name: "Peck Deck", sets: 4, reps: 10 },
    { name: "Desenvolvimento", sets: 3, reps: 12 },
    { name: "Elevação lateral", sets: 3, reps: 12 },
  ]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap">
        <select
          defaultValue={badge}
          aria-label="Dia da semana"
          className={`${cell} w-[5.5rem] shrink-0 font-semibold text-sm`}
        >
          {copy.onboarding.weekdays.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <input
          defaultValue={focus}
          placeholder={copy.onboarding.workout.focusPlaceholder}
          aria-label={copy.onboarding.workout.focus}
          className={`${cell} min-w-0 flex-1 basis-40 text-[15px] font-semibold`}
        />
      </div>

      <SectionHead
        left={copy.sheets.workout.exercises.toUpperCase()}
        right={`${rows.length} EXERCÍCIOS · ${rows.reduce((n, r) => n + r.sets, 0)} SÉRIES`}
      />

      <ul className="flex flex-col gap-2 list-none">
        {rows.map((r, i) => (
          <li
            key={i}
            className="flex items-center gap-2 flex-wrap sm:flex-nowrap border-2 border-forest rounded-lg bg-white px-2 py-2"
          >
            <span
              aria-hidden
              className="shrink-0 w-6 h-6 rounded bg-cream border-2 border-forest flex items-center justify-center font-mono text-[10px] font-bold"
            >
              {i + 1}
            </span>
            <input
              defaultValue={r.name}
              aria-label={`Exercício ${i + 1}`}
              className={`${cell} min-w-0 flex-1 basis-32 font-semibold text-sm`}
            />
            <input
              defaultValue={r.sets}
              inputMode="numeric"
              aria-label="Séries"
              className={`${num} shrink-0 w-12`}
            />
            <span aria-hidden className="shrink-0 opacity-40 text-sm">
              ×
            </span>
            <input
              defaultValue={r.reps}
              inputMode="numeric"
              aria-label="Repetições"
              className={`${num} shrink-0 w-12`}
            />
            <select
              aria-label="Unidade"
              className={`${cell} shrink-0 w-[4.75rem] font-mono text-xs px-1.5`}
            >
              <option>reps</option>
              <option>seg</option>
              <option>km</option>
            </select>
            <RemoveCell
              label={`Remover exercício ${i + 1}`}
              onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
            />
          </li>
        ))}
      </ul>

      <AddButton
        label={copy.onboarding.workout.addExercise}
        onClick={() => setRows((p) => [...p, { name: "", sets: 3, reps: 10 }])}
      />
    </div>
  );
}

// ─── Book ────────────────────────────────────────────────────────────────────

// Title on its own line, author and pages sharing the next, then the
// reading-now flag. The current page only appears once the flag is on: a
// "160 of 464" on a book you have not started is a number with no meaning.
function BookForm({ title }: { title: string }) {
  const [reading, setReading] = useState(true);

  return (
    <div className="flex flex-col gap-3">
      <Field label="Título">
        <input
          defaultValue={title}
          className={`${cell} w-full text-[15px] font-semibold`}
        />
      </Field>

      <div className="flex gap-2 flex-wrap">
        <Field label="Autor" className="min-w-0 flex-1 basis-40">
          <input defaultValue="Tomás de Kempis" className={`${cell} w-full`} />
        </Field>
        <Field label="Páginas" className="shrink-0">
          <input defaultValue={464} inputMode="numeric" className={`${num} w-24`} />
        </Field>
      </div>

      {/* A switch rather than a checkbox: this is a state the book is IN, not
          an item being ticked off a list, and only one book is in it at a
          time. The track carries the same 2px border as everything else so it
          reads as part of the system rather than as a stock control. */}
      <label
        className={`flex items-center gap-3 flex-wrap min-h-[48px] px-3 py-2 rounded-lg border-2 cursor-pointer ${
          reading ? "bg-mint border-clover" : "bg-cream border-sand"
        }`}
      >
        <input
          type="checkbox"
          role="switch"
          checked={reading}
          onChange={(e) => setReading(e.target.checked)}
          className="sr-only peer"
        />
        <span
          aria-hidden
          className={`shrink-0 w-12 h-7 rounded-full border-2 border-forest flex items-center px-0.5 transition-colors duration-150 motion-reduce:transition-none peer-focus-visible:ring-2 peer-focus-visible:ring-clover peer-focus-visible:ring-offset-2 ${
            reading ? "bg-clover" : "bg-white"
          }`}
        >
          <span
            className={`w-5 h-5 rounded-full border-2 border-forest bg-white transition-transform duration-150 motion-reduce:transition-none ${
              reading ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </span>
        <span className="font-semibold text-sm flex-1">Lendo agora</span>
        {reading && (
          <span className="flex items-center gap-2 shrink-0">
            <input
              defaultValue={160}
              inputMode="numeric"
              aria-label="Página atual"
              className={`${num} w-20 bg-white`}
            />
            <span className="text-sm opacity-60">de 464</span>
          </span>
        )}
      </label>
    </div>
  );
}

// ─── Routine block ───────────────────────────────────────────────────────────

// Name first, deliberately: the block IS its name, and leading with two time
// fields made every row open on the least memorable thing about it.
function BlockForm({ name, copy }: { name: string; copy: Copy }) {
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);

  return (
    <div className="flex flex-col gap-3">
      <Field label="Nome do bloco">
        <input
          defaultValue={name}
          className={`${cell} w-full text-[15px] font-semibold`}
        />
      </Field>

      <div className="flex items-end gap-2 flex-wrap">
        <Field label="Início" className="min-w-0 flex-1">
          <input type="time" defaultValue="06:00" className={`${cell} font-mono w-full`} />
        </Field>
        <span aria-hidden className="h-[40px] flex items-center opacity-40">
          —
        </span>
        <Field label="Fim" className="min-w-0 flex-1">
          <input type="time" defaultValue="07:00" className={`${cell} font-mono w-full`} />
        </Field>
      </div>

      <div>
        <SectionHead left="DIAS" right="o check diário cobra só nesses dias" />
        <div className="flex gap-1.5 flex-wrap mt-2">
          {copy.onboarding.weekdays.map((d, i) => {
            const on = days.includes(i + 1);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={d}
                onClick={() =>
                  setDays((prev) =>
                    on ? prev.filter((x) => x !== i + 1) : [...prev, i + 1]
                  )
                }
                className={`w-11 h-11 shrink-0 rounded-lg border-2 font-bold text-sm ${
                  on
                    ? "bg-clover text-white border-forest"
                    : "bg-white border-sand opacity-60"
                }`}
              >
                {d.slice(0, 1)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Small shared pieces ─────────────────────────────────────────────────────

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block mb-1 font-semibold text-xs">{label}</span>
      {children}
    </label>
  );
}

function SectionHead({ left, right }: { left: string; right?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap">
      <p className="font-mono text-[9.5px] font-bold tracking-widest opacity-55">
        {left}
      </p>
      {right && (
        <p className="font-mono text-[9.5px] font-bold tracking-widest opacity-45">
          {right}
        </p>
      )}
    </div>
  );
}

function RemoveCell({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-lg border-2 border-forest bg-white"
    >
      <X className="w-4 h-4 text-[#a8452f]" aria-hidden />
    </button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[44px] inline-flex items-center justify-center px-4 self-start rounded-full border-2 border-dashed border-forest/50 font-semibold text-sm"
    >
      <Plus className="w-4 h-4 mr-1.5" aria-hidden />
      {label}
    </button>
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
