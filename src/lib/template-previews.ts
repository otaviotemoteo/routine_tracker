import { format, plural, type Copy } from "@/lib/i18n";
import type { GenericTemplateKind } from "@/lib/templates";

// What the card-style chooser shows inside an option before it's chosen: a
// small, honest mock of the real Today card — same hero+panel anatomy, same
// copy strings as today-card.ts, but fed by illustrative numbers rather than
// a real day. `copy.templates.previewNote` says as much on screen, so this
// never has to pretend to be live data.
export interface TemplatePreview {
  pending: boolean;
  heroValue: string;
  heroUnit: string;
  panelLabel: string;
  panelText?: string;
  items?: { label: string; done: boolean }[];
}

const EXAMPLE_STREAK = 4;

export function templatePreviewFor(
  kind: GenericTemplateKind,
  habit: { unit: string | null; target: number | null; config: unknown },
  copy: Copy["today"]
): TemplatePreview {
  switch (kind) {
    case "number": {
      const target = habit.target ?? 8;
      const value = Math.max(1, Math.round(target * 0.75));
      return {
        pending: false,
        heroValue: String(value),
        heroUnit: habit.unit ?? copy.plainUnitCount,
        panelLabel: copy.panelLogged,
        panelText: format(copy.plainOfTarget, {
          value,
          target,
          unit: habit.unit ?? "",
        }).trim(),
      };
    }

    case "check":
      return {
        pending: false,
        heroValue: "✓",
        heroUnit: copy.plainDone,
        panelLabel: copy.panelStreak,
        panelText: format(copy.noteStreakDays, { n: EXAMPLE_STREAK }),
      };

    case "duration": {
      const value = 45;
      return {
        pending: false,
        heroValue: String(value),
        heroUnit: habit.unit ?? copy.plainUnitMinutes,
        panelLabel: copy.panelLogged,
        panelText: `${value * 3} ${copy.hobbyWeekMinutes} ${copy.thisWeek}`,
      };
    }

    case "checklist": {
      const configRecord =
        habit.config && typeof habit.config === "object"
          ? (habit.config as Record<string, unknown>)
          : null;
      const configured = Array.isArray(configRecord?.items)
        ? configRecord!.items.filter((i): i is string => typeof i === "string")
        : [];
      const items =
        configured.length > 0
          ? configured
          : ["Stretch", "Cold shower", "Journal"];
      const done = Math.max(1, Math.ceil(items.length / 2));
      return {
        pending: false,
        heroValue: `${done}/${items.length}`,
        heroUnit: copy.unitChecklistItems,
        panelLabel: copy.panelLogged,
        items: items.map((label, i) => ({ label, done: i < done })),
      };
    }

    case "streak":
      return {
        pending: false,
        heroValue: String(EXAMPLE_STREAK),
        heroUnit: plural(EXAMPLE_STREAK, copy.unitStreakDay, copy.unitStreakDays),
        panelLabel: copy.panelStreak,
        panelText: habit.target
          ? format(copy.ctxTarget, { n: habit.target, unit: habit.unit ?? "" }).trim()
          : copy.ctxNoTarget,
      };
  }
}
