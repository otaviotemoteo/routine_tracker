// App-wide i18n. English is the default; Portuguese via the LanguageSelect
// (top right, every screen). The choice lives in a non-httpOnly cookie so the
// client can set it and server components can read it. Habit names come from
// the database in Portuguese and are localized here by slug.

export type Lang = "en" | "pt";

export const LANG_COOKIE = "lang";

export function resolveLang(value: string | undefined): Lang {
  return value === "pt" ? "pt" : "en";
}

export function htmlLang(lang: Lang): string {
  return lang === "pt" ? "pt-BR" : "en";
}

export function locale(lang: Lang): string {
  return lang === "pt" ? "pt-BR" : "en-US";
}

// Client-safe: parses the lang cookie from document.cookie. Used only where
// a Server Component can't reach cookies() — the client-only error boundary.
export function readLangCookieClient(): Lang {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/(?:^|; )lang=([^;]+)/);
  return resolveLang(match?.[1]);
}

export type LoginErrorCode = "missing" | "wrong" | "server" | "rate_limited";

// Copy is passed from Server Components into Client Components, so every
// value must be serializable — templates with {placeholders}, never functions.
export function format(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match
  );
}

export function plural(count: number, one: string, other: string): string {
  return count === 1 ? one : other;
}

const HABIT_NAMES_EN: Record<string, string> = {
  treino: "Workout",
  leitura: "Reading",
  sono: "Sleep",
  rotina: "Routine",
  duolingo: "Duolingo",
  espiritualidade: "Spirituality",
  hobby: "Hobby",
};

// dbName is the seeded pt-BR name — the fallback for both languages.
export function habitName(lang: Lang, slug: string, dbName: string): string {
  if (lang === "en") return HABIT_NAMES_EN[slug] ?? dbName;
  return dbName;
}

export interface Copy {
  metaTitle: string;
  landing: {
    eyebrow: string;
    titlePre: string;
    titleAccent: string;
    lead: string;
    howItWorksLabel: string;
    steps: { title: string; text: string }[];
    loginHeading: string;
    passwordLabel: string;
    submit: string;
    submitting: string;
    errors: {
      missing: string;
      wrong: string;
      server: string;
      rateLimited: string; // {minutes}
    };
  };
  nav: { label: string; today: string; overview: string };
  overview: { eyebrow: string; title: string; weekTab: string; monthTab: string };
  today: {
    title: string;
    progress: string;
    dayComplete: string;
    progressAria: string;
    firstHint: string;
    editHint: string;
    saveError: string;
    optional: string;
    saveButton: string;
    saving: string;
    editButton: string;
    cancel: string;
    savedTitle: string;
    savedText: string;
    savedClose: string;
    doneSr: string;
    notDoneSr: string;
  };
  week: {
    eyebrow: string;
    title: string;
    prevAria: string;
    nextAria: string;
    current: string;
    habitColumnAria: string;
    dayLabels: string[]; // Monday-first
    done: string;
    notDone: string;
    noRecordYet: string;
    best: string;
    worst: string;
    emptyPre: string;
    emptyLink: string;
    emptyPost: string;
  };
  month: {
    eyebrow: string;
    title: string;
    prevAria: string;
    nextAria: string;
    current: string;
    optional: string;
    streakAria: string; // {count} {unit}
    dayUnitOne: string;
    dayUnitOther: string;
    adherenceAria: string; // {name}
    emptyPre: string;
    emptyLink: string;
    emptyPost: string;
  };
  errorPage: { title: string; text: string; retry: string };
}

export const COPY: Record<Lang, Copy> = {
  en: {
    metaTitle: "Tracker — daily habits",
    landing: {
      eyebrow: "Personal tracker",
      titlePre: "Mark what you did",
      titleAccent: "today",
      lead: "Seven habits, one tap a day. See your consistency over the week and the month.",
      howItWorksLabel: "How it works",
      steps: [
        { title: "Today", text: "Check off the day's habits with one tap." },
        { title: "Week", text: "See the consistency grid, day by day." },
        { title: "Month", text: "Track adherence and each habit's streak." },
      ],
      loginHeading: "Sign in",
      passwordLabel: "Password",
      submit: "Sign in",
      submitting: "Signing in…",
      errors: {
        missing: "Type the password.",
        wrong: "Wrong password. Try again.",
        server: "Server is missing APP_PASSWORD or AUTH_SECRET.",
        rateLimited: "Too many attempts. Try again in {minutes} min.",
      },
    },
    nav: { label: "Main navigation", today: "Today", overview: "Overview" },
    overview: {
      eyebrow: "Your history",
      title: "Overview",
      weekTab: "Week",
      monthTab: "Month",
    },
    today: {
      title: "Today",
      progress: "Progress",
      dayComplete: "Day complete",
      progressAria: "Required habits done today",
      firstHint: "Pick what you did, then confirm below.",
      editHint: "Change what you need and save again.",
      saveError: "Couldn't save. Check your connection and try again.",
      optional: "optional",
      saveButton: "I made it today",
      saving: "Saving…",
      editButton: "Edit tasks",
      cancel: "Cancel",
      savedTitle: "All saved",
      savedText: "Today's habits are recorded. Come back anytime to edit them.",
      savedClose: "Close",
      doneSr: "done",
      notDoneSr: "not done",
    },
    week: {
      eyebrow: "Day-by-day consistency",
      title: "Week",
      prevAria: "Previous week",
      nextAria: "Next week",
      current: "Current",
      habitColumnAria: "Habit",
      dayLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      done: "done",
      notDone: "not done",
      noRecordYet: "no record yet",
      best: "Best of the week",
      worst: "Needs attention",
      emptyPre: "No records this week yet — habits checked on",
      emptyLink: "Today",
      emptyPost: "fill the grid.",
    },
    month: {
      eyebrow: "Adherence and streaks",
      title: "Month",
      prevAria: "Previous month",
      nextAria: "Next month",
      current: "Current",
      optional: "optional",
      streakAria: "Current streak: {count} {unit}",
      dayUnitOne: "day",
      dayUnitOther: "days",
      adherenceAria: "{name} adherence this month",
      emptyPre: "No records this month yet — habits checked on",
      emptyLink: "Today",
      emptyPost: "show up here.",
    },
    errorPage: {
      title: "Something went wrong",
      text: "Couldn't load the data. Check your connection and try again.",
      retry: "Try again",
    },
  },
  pt: {
    metaTitle: "Tracker — hábitos diários",
    landing: {
      eyebrow: "Tracker pessoal",
      titlePre: "Marque o que você fez",
      titleAccent: "hoje",
      lead: "Sete hábitos, um toque por dia. Veja sua consistência na semana e no mês.",
      howItWorksLabel: "Como funciona",
      steps: [
        { title: "Hoje", text: "Marque os hábitos do dia com um toque." },
        { title: "Semana", text: "Veja o grid de consistência, dia a dia." },
        { title: "Mês", text: "Acompanhe a adesão e a sequência de cada hábito." },
      ],
      loginHeading: "Entrar",
      passwordLabel: "Senha",
      submit: "Entrar",
      submitting: "Entrando…",
      errors: {
        missing: "Digite a senha.",
        wrong: "Senha incorreta. Tente de novo.",
        server: "Servidor sem APP_PASSWORD ou AUTH_SECRET configurados.",
        rateLimited: "Muitas tentativas. Tente de novo em {minutes} min.",
      },
    },
    nav: { label: "Navegação principal", today: "Hoje", overview: "Visão geral" },
    overview: {
      eyebrow: "Seu histórico",
      title: "Visão geral",
      weekTab: "Semana",
      monthTab: "Mês",
    },
    today: {
      title: "Hoje",
      progress: "Progresso",
      dayComplete: "Dia completo",
      progressAria: "Hábitos obrigatórios concluídos hoje",
      firstHint: "Marque o que você fez e confirme abaixo.",
      editHint: "Ajuste o que precisar e salve de novo.",
      saveError: "Não deu para salvar. Confira a conexão e tente de novo.",
      optional: "opcional",
      saveButton: "Marquei hoje",
      saving: "Salvando…",
      editButton: "Editar tarefas",
      cancel: "Cancelar",
      savedTitle: "Tudo salvo",
      savedText: "Os hábitos de hoje foram registrados. Você pode editar quando quiser.",
      savedClose: "Fechar",
      doneSr: "feito",
      notDoneSr: "não feito",
    },
    week: {
      eyebrow: "Consistência dia a dia",
      title: "Semana",
      prevAria: "Semana anterior",
      nextAria: "Próxima semana",
      current: "Atual",
      habitColumnAria: "Hábito",
      dayLabels: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
      done: "feito",
      notDone: "não feito",
      noRecordYet: "ainda sem registro",
      best: "Melhor da semana",
      worst: "Precisa de atenção",
      emptyPre: "Nenhum registro nesta semana ainda — os hábitos marcados em",
      emptyLink: "Hoje",
      emptyPost: "preenchem o grid.",
    },
    month: {
      eyebrow: "Adesão e sequência",
      title: "Mês",
      prevAria: "Mês anterior",
      nextAria: "Próximo mês",
      current: "Atual",
      optional: "opcional",
      streakAria: "Sequência atual: {count} {unit}",
      dayUnitOne: "dia",
      dayUnitOther: "dias",
      adherenceAria: "Adesão de {name} no mês",
      emptyPre: "Nenhum registro neste mês ainda — os hábitos marcados em",
      emptyLink: "Hoje",
      emptyPost: "aparecem aqui.",
    },
    errorPage: {
      title: "Algo deu errado",
      text: "Não deu para carregar os dados. Confira a conexão e tente de novo.",
      retry: "Tentar de novo",
    },
  },
};
