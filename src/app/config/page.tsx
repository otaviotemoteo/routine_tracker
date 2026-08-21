import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { WorkoutStep } from "@/components/onboarding/WorkoutStep";
import { ReadingStep } from "@/components/onboarding/ReadingStep";
import { SleepStep } from "@/components/onboarding/SleepStep";
import { RoutineStep } from "@/components/onboarding/RoutineStep";
import { DuolingoStep } from "@/components/onboarding/DuolingoStep";
import { SpiritualityStep } from "@/components/onboarding/SpiritualityStep";
import { ActivityForm } from "@/components/habits/ActivityForm";
import { LanguageSelect } from "@/components/landing/LanguageSelect";
import { listTrackedActivities, getActivity } from "@/db/habits";
import {
  saveDuolingoStep,
  saveReadingStep,
  saveRoutineStep,
  saveSleepStep,
  saveSpiritualityStep,
  saveWorkoutStep,
  updateActivityAction,
} from "@/app/config/actions";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import {
  duolingoInitial,
  readingInitial,
  routineInitial,
  sleepInitial,
  spiritualityInitial,
  workoutInitial,
} from "@/lib/onboarding-prefill";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

interface ConfigPageProps {
  searchParams: Promise<{ activity?: string; from?: string }>;
}

// Every tracked habit, each showing its own activities — not six fixed
// sections. Clicking an activity dispatches to the rich-kind step component
// that matches its template_kind, or the generic ActivityForm for a plain
// one. See docs/ARCHITECTURE.md. Both Back and Save return
// wherever the edit was entered from — /config by default, or Overview when
// reached from its Activities section (`?from=overview`).
export default async function ConfigPage({ searchParams }: ConfigPageProps) {
  const userId = await requireUserId();
  const lang = await getLang();
  const copy = COPY[lang].onboarding;
  const habitsCopy = COPY[lang].habits;
  const { activity: activityParam, from } = await searchParams;
  const activityId = activityParam ? Number(activityParam) : null;

  const origin =
    from === "overview"
      ? "/overview"
      : from === "onboarding"
        ? "/onboarding/activities"
        : "/config";
  const back = origin;
  const next = origin;
  const submit = copy.save;

  if (activityId === null) {
    const activities = await listTrackedActivities(userId);
    const byHabit = new Map<
      number,
      { habitName: string; activities: typeof activities }
    >();
    for (const a of activities) {
      const group = byHabit.get(a.habitId) ?? { habitName: a.habitName, activities: [] };
      group.activities.push(a);
      byHabit.set(a.habitId, group);
    }

    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-24">
        <div className="flex justify-end mb-4">
          <LanguageSelect current={lang} />
        </div>
        <p className="eyebrow">{copy.config.eyebrow}</p>
        <h1 className="display-title text-4xl sm:text-5xl mt-2 mb-5">
          {copy.config.title}
        </h1>
        <p className="opacity-75 mb-6">{copy.config.lead}</p>

        {byHabit.size === 0 ? (
          <p className="opacity-75">{habitsCopy.emptyLead}</p>
        ) : (
          <div className="flex flex-col gap-6">
            {[...byHabit.entries()].map(([habitId, group]) => (
              <section key={habitId}>
                <h2 className="eyebrow mb-2.5">{group.habitName}</h2>
                <ul className="flex flex-col gap-3 list-none">
                  {group.activities.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/config?activity=${a.id}${from ? `&from=${from}` : ""}`}
                        className="min-h-[64px] flex items-center justify-between gap-3 px-5 py-3 rounded-card border-2 border-forest bg-white shadow-hard hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg transition-[transform,box-shadow] duration-150"
                      >
                        <span className="min-w-0">
                          <span className="block font-semibold">{a.name}</span>
                        </span>
                        <ChevronRight className="w-5 h-5 shrink-0" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-1.5 font-semibold text-sm underline min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />
          {copy.back}
        </Link>
      </main>
    );
  }

  if (!Number.isInteger(activityId) || activityId <= 0) notFound();
  const activity = await getActivity(userId, activityId);
  if (!activity) notFound();

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-24">
      <div className="flex justify-end mb-4">
        <LanguageSelect current={lang} />
      </div>
      {activity.templateKind === "treino" && (
        <WorkoutStep
          action={saveWorkoutStep.bind(null, activityId)}
          next={next}
          backHref={back}
          submitLabel={submit}
          copy={copy}
          requireDirtyToSave
          titleBackHref={origin}
          {...(await workoutInitial(userId, activityId))}
        />
      )}
      {activity.templateKind === "leitura" && (
        <ReadingStep
          action={saveReadingStep.bind(null, activityId)}
          next={next}
          backHref={back}
          submitLabel={submit}
          copy={copy}
          requireDirtyToSave
          titleBackHref={origin}
          {...(await readingInitial(userId, activityId))}
        />
      )}
      {activity.templateKind === "sono" && (
        <SleepStep
          action={saveSleepStep.bind(null, activityId)}
          next={next}
          backHref={back}
          submitLabel={submit}
          copy={copy}
          requireDirtyToSave
          titleBackHref={origin}
          {...(await sleepInitial(userId, activityId))}
        />
      )}
      {activity.templateKind === "rotina" && (
        <RoutineStep
          action={saveRoutineStep.bind(null, activityId)}
          next={next}
          backHref={back}
          submitLabel={submit}
          copy={copy}
          requireDirtyToSave
          titleBackHref={origin}
          initialBlocks={await routineInitial(userId, activityId)}
        />
      )}
      {activity.templateKind === "duolingo" && (
        <DuolingoStep
          action={saveDuolingoStep.bind(null, activityId)}
          next={next}
          backHref={back}
          submitLabel={submit}
          copy={copy}
          requireDirtyToSave
          titleBackHref={origin}
          initialLanguages={await duolingoInitial(userId, activityId)}
        />
      )}
      {activity.templateKind === "espiritualidade" && (
        <SpiritualityStep
          action={saveSpiritualityStep.bind(null, activityId)}
          next={next}
          backHref={back}
          submitLabel={submit}
          copy={copy}
          requireDirtyToSave
          titleBackHref={origin}
          initialPractices={await spiritualityInitial(userId, activityId)}
        />
      )}
      {/* Hobby has no setup at all — see src/lib/templates.ts — so there is
          nothing for this screen to edit. Anything else (null, or one of the
          five card-style-chooser kinds) is a plain activity. */}
      {activity.templateKind === "hobby" && (
        <p className="opacity-75 mt-6">{habitsCopy.emptyLead}</p>
      )}
      {activity.templateKind !== "treino" &&
        activity.templateKind !== "leitura" &&
        activity.templateKind !== "sono" &&
        activity.templateKind !== "rotina" &&
        activity.templateKind !== "duolingo" &&
        activity.templateKind !== "espiritualidade" &&
        activity.templateKind !== "hobby" && (
          <ActivityForm
            action={updateActivityAction}
            initial={{
              id: activity.id,
              name: activity.name,
              metricType: activity.metricType,
              unit: activity.unit ?? "",
              target: activity.target === null ? "" : String(activity.target),
              minimalAction: activity.minimalAction ?? "",
            }}
            copy={habitsCopy}
            next={next}
            cancelHref={back}
          />
        )}
    </main>
  );
}
