"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { setHabitTemplateAction } from "@/app/(app)/habits/templates/actions";
import { templatePreviewFor } from "@/lib/template-previews";
import { type Copy } from "@/lib/i18n";
import type { GenericTemplateKind } from "@/lib/templates";
import type { HabitRow } from "@/db/habits";

interface TemplateOptionProps {
  habit: HabitRow;
  kind: GenericTemplateKind;
  chosen: boolean;
  suggested: boolean;
  copy: Copy["templates"];
  todayCopy: Copy["today"];
}

// One of the five card-style options inside an open habit row. Four of the
// five are a single tap — a form with two hidden fields, saved the instant
// it's pressed (see setHabitTemplateAction). Checklist alone needs one more
// answer — its own item names — before there's anything to save, so it's a
// different component below that shows an inline form instead of an instant
// submit.
export function TemplateOption({
  habit,
  kind,
  chosen,
  suggested,
  copy,
  todayCopy,
}: TemplateOptionProps) {
  if (kind === "checklist") {
    return (
      <ChecklistOption
        habit={habit}
        chosen={chosen}
        suggested={suggested}
        copy={copy}
        todayCopy={todayCopy}
      />
    );
  }

  const preview = templatePreviewFor(kind, habit, todayCopy);

  return (
    <form action={setHabitTemplateAction}>
      <input type="hidden" name="habitId" value={habit.id} />
      <input type="hidden" name="kind" value={kind} />
      <button type="submit" className={optionShellClass(chosen, suggested)}>
        <OptionHeader kind={kind} chosen={chosen} suggested={suggested} copy={copy} />
        <PreviewBlock preview={preview} />
        <OptionAction chosen={chosen} suggested={suggested} copy={copy} />
      </button>
    </form>
  );
}

// Checklist: reveals a textarea to name 2–8 steps before it can be chosen.
// Once chosen, the option shows the real preview (the user's own items) plus
// a ghost "Edit items" button that reopens the same form, prefilled — so
// naming items once doesn't mean they're stuck forever.
function ChecklistOption({
  habit,
  chosen,
  suggested,
  copy,
  todayCopy,
}: Omit<TemplateOptionProps, "kind">) {
  const configRecord =
    habit.config && typeof habit.config === "object"
      ? (habit.config as Record<string, unknown>)
      : null;
  const existingItems = Array.isArray(configRecord?.items)
    ? configRecord!.items.filter((i): i is string => typeof i === "string")
    : [];
  const [editing, setEditing] = useState(existingItems.length === 0);
  const [draft, setDraft] = useState(existingItems.join("\n"));
  const canSave = draft.split("\n").some((line) => line.trim().length > 0);

  const preview = templatePreviewFor("checklist", habit, todayCopy);

  if (editing) {
    return (
      <div className={optionShellClass(chosen, suggested, "cursor-default")}>
        <OptionHeader kind="checklist" chosen={chosen} suggested={suggested} copy={copy} />
        {existingItems.length === 0 && <PreviewBlock preview={preview} example />}
        <form action={setHabitTemplateAction} className="flex flex-col gap-2">
          <input type="hidden" name="habitId" value={habit.id} />
          <input type="hidden" name="kind" value="checklist" />
          <label className="text-xs font-bold uppercase tracking-wide opacity-60">
            {copy.checklistItemsLabel}
          </label>
          <textarea
            name="items"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={copy.checklistPlaceholder}
            rows={4}
            className="w-full px-3 py-2 border-2 border-forest rounded-lg bg-white font-semibold text-sm"
          />
          {!canSave && (
            <p className="text-xs text-straw font-semibold">
              {copy.checklistNeedsOne}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!canSave}
              className="min-h-[44px] px-4 rounded-full border-2 border-forest bg-clover text-white font-semibold text-sm shadow-hard-sm disabled:opacity-50"
            >
              {copy.checklistSave}
            </button>
            {existingItems.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDraft(existingItems.join("\n"));
                  setEditing(false);
                }}
                className="min-h-[44px] px-4 rounded-full border-2 border-forest bg-white font-semibold text-sm"
              >
                {copy.checklistCancel}
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={optionShellClass(chosen, suggested, "cursor-default")}>
      <OptionHeader kind="checklist" chosen={chosen} suggested={suggested} copy={copy} />
      <PreviewBlock preview={preview} />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <OptionAction chosen={chosen} suggested={suggested} copy={copy} />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-[44px] inline-flex items-center text-xs font-bold underline opacity-70"
        >
          {copy.checklistEditItems}
        </button>
      </div>
    </div>
  );
}

function optionShellClass(
  chosen: boolean,
  suggested: boolean,
  extra = ""
): string {
  const border = suggested && !chosen ? "border-dashed" : "border-solid";
  const bg = chosen ? "bg-white" : suggested ? "bg-straw/10" : "bg-cream";
  return `w-full text-left rounded-card border-2 ${border} border-forest ${bg} shadow-hard-sm px-3.5 py-3 flex flex-col gap-2.5 ${extra}`;
}

function OptionHeader({
  kind,
  chosen,
  suggested,
  copy,
}: {
  kind: GenericTemplateKind;
  chosen: boolean;
  suggested: boolean;
  copy: Copy["templates"];
}) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-sm">{copy.names[kind]}</span>
        {chosen && (
          <span className="inline-flex items-center gap-1 font-mono text-[0.6rem] font-bold uppercase tracking-wider text-clover bg-mint border border-clover rounded-full px-2 py-0.5">
            <Check className="w-2.5 h-2.5" strokeWidth={3.5} aria-hidden />
            {copy.chosenBadge}
          </span>
        )}
        {!chosen && suggested && (
          <span className="font-mono text-[0.6rem] font-bold uppercase tracking-wider text-straw bg-straw/15 border border-dashed border-straw rounded-full px-2 py-0.5">
            {copy.suggestedBadge}
          </span>
        )}
      </span>
      <span className="text-xs opacity-70 leading-snug">
        {copy.descriptions[kind]}
      </span>
    </span>
  );
}

function OptionAction({
  chosen,
  suggested,
  copy,
}: {
  chosen: boolean;
  suggested: boolean;
  copy: Copy["templates"];
}) {
  const text = chosen
    ? copy.actionChosen
    : suggested
      ? copy.actionSuggested
      : copy.actionPick;
  const color = chosen ? "text-clover" : suggested ? "text-straw" : "opacity-60";
  return <span className={`text-xs font-bold ${color}`}>{text}</span>;
}

// The mini "what your Today card will look like" mock — same hero+panel
// anatomy as the real thing, at a smaller scale, fed by illustrative numbers.
function PreviewBlock({
  preview,
  example,
}: {
  preview: ReturnType<typeof templatePreviewFor>;
  example?: boolean;
}) {
  return (
    <span
      className={`flex flex-col gap-2 rounded-lg border-2 border-forest px-3 py-2.5 bg-white ${
        example ? "opacity-60" : ""
      }`}
    >
      <span className="flex items-baseline gap-1.5">
        <span className="font-mono font-bold text-lg leading-none">
          {preview.heroValue}
        </span>
        <span className="text-xs font-semibold opacity-60">
          {preview.heroUnit}
        </span>
      </span>
      <span className="flex flex-col gap-1 rounded-md bg-mint px-2.5 py-2">
        <span className="font-mono text-[0.55rem] font-bold uppercase tracking-widest text-clover/70">
          {preview.panelLabel}
        </span>
        {preview.panelText && (
          <span className="text-[0.7rem] font-semibold leading-snug">
            {preview.panelText}
          </span>
        )}
        {preview.items && (
          <span className="flex flex-col gap-1">
            {preview.items.map((item) => (
              <span
                key={item.label}
                className="flex items-center gap-1.5 text-[0.7rem]"
              >
                {item.done ? (
                  <Check
                    className="w-3 h-3 shrink-0 text-clover"
                    strokeWidth={3.5}
                    aria-hidden
                  />
                ) : (
                  <span
                    aria-hidden
                    className="w-3 h-3 shrink-0 rounded-[3px] border-2 border-forest/20"
                  />
                )}
                <span className={item.done ? "font-medium" : "font-medium opacity-55"}>
                  {item.label}
                </span>
              </span>
            ))}
          </span>
        )}
      </span>
    </span>
  );
}
