"use client";

import { useState } from "react";
import { HabitRow as HabitRowCard } from "@/components/habits/HabitRow";
import { ListCard } from "@/components/onboarding/ListCard";
import { SetupPanel } from "@/components/onboarding/SetupPanel";
import { inputClass } from "@/components/ui/styles";
import { COPY, format, type Lang } from "@/lib/i18n";
import type { HabitRow } from "@/db/habits";

// The half of the preview that has to be pressed to be judged.
//
// A screenshot of an accordion tells you nothing about whether opening it
// feels right, and the inline remove confirmation is invisible until you ask
// for it — so both are here, live, with the confirmation reachable in one tap
// rather than by deleting something real.
export function PreviewBoard({
  lang,
  habits,
}: {
  lang: Lang;
  habits: HabitRow[];
}) {
  const copy = COPY[lang];
  const [open, setOpen] = useState<number | null>(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [bedtime, setBedtime] = useState("23:00");
  const [wake, setWake] = useState("06:00");

  const mins = (t: string) => {
    const [h, m] = t.slice(0, 5).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const hours = Math.round(
    ((((mins(wake) - mins(bedtime)) % 1440) + 1440) % 1440) / 60
  );

  const days = [
    { badge: "Seg", focus: "Peito + Ombro", ex: 5, sets: 18 },
    { badge: "Ter", focus: "Costas + Trapézio", ex: 5, sets: 18 },
    { badge: "Qua", focus: "Pernas", ex: 5, sets: 20 },
  ];

  return (
    <>
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

      <Block title="Acordeão — dobrado, aberto e confirmando remoção">
        <p className="text-sm opacity-60 mb-3">
          Toque no lixo de qualquer linha para ver a confirmação inline.
        </p>
        <div className="flex flex-col gap-2.5">
          {days.map((d, i) => (
            <ListCard
              key={d.badge}
              title={d.focus}
              badge={d.badge}
              chips={[
                { text: `${d.ex} EXERCÍCIOS`, tone: "count" },
                { text: format(copy.onboarding.setCount, { n: d.sets }), tone: "muted" },
              ]}
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
              removeConfirm={format(copy.onboarding.confirmRemove, {
                name: d.focus,
              })}
              removeWarning={copy.onboarding.confirmWarning}
              removeCancel={copy.onboarding.confirmCancel}
              removeGo={copy.onboarding.confirmGo}
              read={
                <ul className="text-sm flex flex-col gap-1 list-none opacity-80">
                  <li>Supino reto com halteres · 4 × 10</li>
                  <li>Supino inclinado na máquina · 4 × 10</li>
                  <li>Peck Deck · 4 × 10</li>
                </ul>
              }
            >
              <p className="text-sm opacity-60">(formulário do dia)</p>
            </ListCard>
          ))}
        </div>
      </Block>

      <Block title="Sono — janela recalculada ao vivo">
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
