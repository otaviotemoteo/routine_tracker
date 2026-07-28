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
  overview: {
    eyebrow: string;
    title: string;
    weekTab: string;
    monthTab: string;
    summary: {
      title: string;
      avgSleep: string;
      totalPages: string;
      workout: string;
      lessons: string;
      practices: string;
    };
  };
  dayAudit: { eyebrow: string; notLogged: string; back: string; noneLogged: string };
  daily: {
    start: string;
    eyebrow: string;
    question: string; // {habit}
    stepOf: string; // {current} / {total}
    save: string;
    saving: string;
    skip: string;
    back: string;
    finish: string;
    saveError: string;
    doneToday: string;
  };
  today: {
    title: string;
    progress: string;
    dayComplete: string;
    progressAria: string;
    fillHint: string;
    optional: string;
    doneLabel: string;
    pendingLabel: string;
    restDay: string;
    notConfigured: string;
    pageOf: string; // {current} {total}
    sleepTarget: string; // {from} {to}
    blockToday: string; // {n} — singular
    blocksToday: string; // {n} — plural
    practiceToday: string; // {n} — singular
    practicesToday: string; // {n} — plural
    pace: string; // {n}
    bookMissing: string; // {n} — singular
    booksMissing: string; // {n} — plural
    activities: string;
    activitiesLead: string;
    notSet: string;
    edit: string;
    configured: string;
    notConfiguredBadge: string;
  };
  sheets: {
    save: string;
    saving: string;
    close: string;
    note: string;
    notePlaceholder: string;
    saveError: string;
    workout: {
      plan: string;
      effort: string;
      noPlan: string;
      otherTraining: string;
      pickTraining: string;
      restLabel: string;
    };
    reading: {
      endedOnPage: string;
      pagesRead: string;
      noBook: string;
      of: string;
      finishEstimate: string; // {date}
      finishToday: string;
    };
    sleep: { hours: string; wokeUp: string; quality: string };
    routine: { followed: string; struggled: string; struggleNote: string; none: string; noBlocks: string };
    duolingo: { lessons: string; noLanguages: string };
    spirituality: { noPractices: string };
    hobby: { activity: string; activityPlaceholder: string; minutes: string };
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
  onboarding: {
    stepOf: string; // {current} / {total}
    skip: string;
    back: string;
    continue: string;
    finish: string;
    save: string;
    saving: string;
    backTo: string; // {section}
    weekdays: string[]; // Mon..Sun, ISO order (7)
    welcome: { title: string; lead: string; time: string; items: string[]; start: string };
    workout: {
      title: string;
      lead: string;
      planName: string;
      weekday: string;
      focus: string;
      focusPlaceholder: string;
      exercises: string;
      exerciseName: string;
      sets: string;
      reps: string;
      kindReps: string;
      kindTime: string;
      kindDistance: string;
      seconds: string;
      distance: string;
      minutes: string;
      measuredBy: string;
      addExercise: string;
      removeExercise: string;
      addDay: string;
      removeDay: string;
      exerciseCount: string; // {n} — singular
      exerciseCountPlural: string; // {n} — plural
      empty: string;
    };
    reading: {
      title: string;
      lead: string;
      goal: string;
      goalUnit: string;
      list: string;
      bookTitle: string;
      author: string;
      pages: string;
      currentPage: string;
      reading: string;
      addBook: string;
      removeBook: string;
      moveUp: string;
      moveDown: string;
      booksCount: string; // {added}/{goal}
      booksRemaining: string; // {n} {goal}
      goalReachedPre: string;
      goalReachedLink: string; // {goal}
      paceNote: string; // {pages} {year}
      paceExplainTitle: string;
      paceExplainText: string;
      paceExplainClose: string;
      paceExplainAria: string;
      empty: string;
    };
    sleep: { title: string; lead: string; bedtime: string; wake: string };
    routine: {
      title: string;
      lead: string;
      start: string;
      end: string;
      activity: string;
      activityPlaceholder: string;
      weekdays: string;
      addBlock: string;
      removeBlock: string;
      empty: string;
    };
    duolingo: {
      title: string;
      lead: string;
      language: string;
      languagePlaceholder: string;
      addLanguage: string;
      removeLanguage: string;
      empty: string;
    };
    spirituality: {
      title: string;
      lead: string;
      name: string;
      countable: string;
      addPractice: string;
      removePractice: string;
      empty: string;
    };
    review: {
      title: string;
      lead: string;
      notSet: string;
      sections: {
        workout: string;
        reading: string;
        sleep: string;
        routine: string;
        duolingo: string;
        spirituality: string;
      };
    };
    config: { eyebrow: string; title: string; lead: string; edit: string };
    unsaved: {
      title: string;
      text: string;
      keepEditing: string;
      leave: string;
    };
  };
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
      summary: {
        title: "This month",
        avgSleep: "Avg sleep",
        totalPages: "Pages read",
        workout: "Workout done",
        lessons: "Lessons",
        practices: "Practices",
      },
    },
    dayAudit: {
      eyebrow: "Day audit",
      notLogged: "Not logged",
      back: "Back to overview",
      noneLogged: "Nothing logged this day.",
    },
    daily: {
      start: "Complete daily",
      eyebrow: "Daily check-in",
      question: "Did you do {habit} today?",
      stepOf: "Step {current} of {total}",
      save: "Save and continue",
      saving: "Saving…",
      skip: "Skip",
      back: "Back",
      finish: "Save and finish",
      saveError: "Couldn't save. Try again.",
      doneToday: "Already logged today",
    },
    today: {
      title: "Today",
      progress: "Progress",
      dayComplete: "Day complete",
      progressAria: "Required habits done today",
      fillHint: "Fill in the day to log what you did.",
      optional: "optional",
      doneLabel: "Done",
      pendingLabel: "Not logged yet",
      restDay: "Rest day",
      notConfigured: "Not set up",
      pageOf: "page {current} of {total}",
      sleepTarget: "Target {from} – {to}",
      blockToday: "{n} block today",
      blocksToday: "{n} blocks today",
      practiceToday: "{n} practice",
      practicesToday: "{n} practices",
      pace: "Read {n} pages/day to stay on track",
      bookMissing: "{n} book still to add",
      booksMissing: "{n} books still to add",
      activities: "Activities",
      activitiesLead: "What you're tracking. Edit any of it anytime.",
      notSet: "Not set",
      edit: "Edit",
      configured: "configured",
      notConfiguredBadge: "not configured",
    },
    sheets: {
      save: "Save",
      saving: "Saving…",
      close: "Cancel",
      note: "Note",
      notePlaceholder: "What could've been better?",
      saveError: "Couldn't save. Try again.",
      workout: {
        plan: "Today's focus",
        effort: "Effort",
        noPlan: "No training planned for today.",
        otherTraining: "I did a different training today",
        pickTraining: "Which one?",
        restLabel: "Rest",
      },
      reading: {
        endedOnPage: "Ended on page",
        pagesRead: "Pages read",
        noBook: "No current book. Add one in settings.",
        of: "of",
        finishEstimate: "At this pace you finish this book on {date}",
        finishToday: "That finishes the book!",
      },
      sleep: { hours: "Hours slept", wokeUp: "Woke up during the night", quality: "Quality" },
      routine: {
        followed: "Blocks followed",
        struggled: "Hardest block",
        struggleNote: "What made it hard?",
        none: "None",
        noBlocks: "No routine blocks for today.",
      },
      duolingo: { lessons: "Lessons", noLanguages: "No languages. Add some in settings." },
      spirituality: { noPractices: "No practices. Add some in settings." },
      hobby: { activity: "Activity", activityPlaceholder: "Guitar, drawing…", minutes: "Minutes" },
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
    onboarding: {
      stepOf: "Step {current} of {total}",
      skip: "Skip",
      back: "Back",
      continue: "Continue",
      finish: "Finish",
      save: "Save",
      saving: "Saving…",
      backTo: "Back to {section}",
      weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      welcome: {
        title: "Let's set up your tracker",
        lead: "A few quick steps so your daily check-in is personalized. About 5 minutes — every step is skippable and editable later.",
        time: "~5 min",
        items: [
          "Your workout plan",
          "Reading goal and list",
          "Sleep, routine and languages",
          "Spiritual practices",
        ],
        start: "Start",
      },
      workout: {
        title: "Workout",
        lead: "Set a focus and exercises for each training day.",
        planName: "Plan name",
        weekday: "Weekday",
        focus: "Focus",
        focusPlaceholder: "Chest + triceps, Legs, Rest…",
        exercises: "Exercises",
        exerciseName: "Exercise",
        sets: "Sets",
        reps: "Reps",
        kindReps: "Reps",
        kindTime: "Time",
        kindDistance: "Distance",
        seconds: "Seconds",
        distance: "km",
        minutes: "Minutes",
        measuredBy: "Measured by",
        addExercise: "Add exercise",
        removeExercise: "Remove exercise",
        addDay: "Add day",
        removeDay: "Remove",
        exerciseCount: "{n} exercise",
        exerciseCountPlural: "{n} exercises",
        empty: "No training days yet.",
      },
      reading: {
        title: "Reading",
        lead: "Set a yearly goal and your reading list.",
        goal: "Books this year",
        goalUnit: "books",
        list: "Reading list",
        bookTitle: "Title",
        author: "Author",
        pages: "Pages",
        currentPage: "Current page",
        reading: "Reading now",
        addBook: "Add book",
        removeBook: "Remove",
        moveUp: "Move up",
        moveDown: "Move down",
        booksCount: "{added} of {goal} books added",
        booksRemaining: "Add {n} more to reach your goal",
        goalReachedPre: "That's your whole goal.",
        goalReachedLink: "Want to read more than {goal}?",
        paceNote:
          "At this list, you need about {pages} pages/day to finish everything by the end of {year}.",
        paceExplainTitle: "How this is calculated",
        paceExplainText:
          "Pages still left in the book you're reading, plus every page of the books after it, divided by the days remaining in the year.",
        paceExplainClose: "Got it",
        paceExplainAria: "How the pace is calculated",
        empty: "No books yet.",
      },
      sleep: {
        title: "Sleep",
        lead: "Your target bedtime and wake time set the default for the daily sleep log.",
        bedtime: "Bedtime",
        wake: "Wake time",
      },
      routine: {
        title: "Routine",
        lead: "Your planned time blocks — the daily check measures how well you followed them.",
        start: "Start",
        end: "End",
        activity: "Activity",
        activityPlaceholder: "Deep work, Gym, Lunch…",
        weekdays: "Days",
        addBlock: "Add block",
        removeBlock: "Remove",
        empty: "No blocks yet.",
      },
      duolingo: {
        title: "Duolingo",
        lead: "Which languages are you learning?",
        language: "Language",
        languagePlaceholder: "English, Italian…",
        addLanguage: "Add language",
        removeLanguage: "Remove",
        empty: "No languages yet.",
      },
      spirituality: {
        title: "Spirituality",
        lead: "Your practices. Countable ones (like rosaries) get a daily number.",
        name: "Practice",
        countable: "Countable",
        addPractice: "Add practice",
        removePractice: "Remove",
        empty: "No practices yet.",
      },
      review: {
        title: "All set",
        lead: "Here's what you configured. You can change any of it later in settings.",
        notSet: "Not set",
        sections: {
          workout: "Workout",
          reading: "Reading",
          sleep: "Sleep",
          routine: "Routine",
          duolingo: "Duolingo",
          spirituality: "Spirituality",
        },
      },
      config: {
        eyebrow: "Settings",
        title: "Configuration",
        lead: "Edit any area you set up during onboarding.",
        edit: "Edit",
      },
      unsaved: {
        title: "Unsaved changes",
        text: "You changed things here but didn't save. Going back discards them.",
        keepEditing: "Keep editing",
        leave: "Discard and go back",
      },
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
      summary: {
        title: "Neste mês",
        avgSleep: "Sono médio",
        totalPages: "Páginas lidas",
        workout: "Treino feito",
        lessons: "Lições",
        practices: "Práticas",
      },
    },
    dayAudit: {
      eyebrow: "Registro do dia",
      notLogged: "Não registrado",
      back: "Voltar à visão geral",
      noneLogged: "Nada registrado neste dia.",
    },
    daily: {
      start: "Preencher o dia",
      eyebrow: "Check-in diário",
      question: "Você fez {habit} hoje?",
      stepOf: "Passo {current} de {total}",
      save: "Salvar e continuar",
      saving: "Salvando…",
      skip: "Pular",
      back: "Voltar",
      finish: "Salvar e concluir",
      saveError: "Não deu para salvar. Tente de novo.",
      doneToday: "Já registrado hoje",
    },
    today: {
      title: "Hoje",
      progress: "Progresso",
      dayComplete: "Dia completo",
      progressAria: "Hábitos obrigatórios concluídos hoje",
      fillHint: "Preencha o dia para registrar o que você fez.",
      optional: "opcional",
      doneLabel: "Feito",
      pendingLabel: "Ainda não registrado",
      restDay: "Dia de descanso",
      notConfigured: "Não configurado",
      pageOf: "página {current} de {total}",
      sleepTarget: "Meta {from} – {to}",
      blockToday: "{n} bloco hoje",
      blocksToday: "{n} blocos hoje",
      practiceToday: "{n} prática",
      practicesToday: "{n} práticas",
      pace: "Leia {n} páginas/dia para manter o ritmo",
      bookMissing: "Falta cadastrar {n} livro",
      booksMissing: "Faltam cadastrar {n} livros",
      activities: "Atividades",
      activitiesLead: "O que você acompanha. Dá para editar quando quiser.",
      notSet: "Não definido",
      edit: "Editar",
      configured: "configurado",
      notConfiguredBadge: "não configurado",
    },
    sheets: {
      save: "Salvar",
      saving: "Salvando…",
      close: "Cancelar",
      note: "Nota",
      notePlaceholder: "O que poderia ter sido melhor?",
      saveError: "Não deu para salvar. Tente de novo.",
      workout: {
        plan: "Foco de hoje",
        effort: "Esforço",
        noPlan: "Nenhum treino planejado para hoje.",
        otherTraining: "Fiz um treino diferente hoje",
        pickTraining: "Qual?",
        restLabel: "Descanso",
      },
      reading: {
        endedOnPage: "Parou na página",
        pagesRead: "Páginas lidas",
        noBook: "Nenhum livro atual. Adicione um nas configurações.",
        of: "de",
        finishEstimate: "Nesse ritmo você termina este livro em {date}",
        finishToday: "Isso termina o livro!",
      },
      sleep: { hours: "Horas dormidas", wokeUp: "Acordou durante a noite", quality: "Qualidade" },
      routine: {
        followed: "Blocos seguidos",
        struggled: "Bloco mais difícil",
        struggleNote: "O que dificultou?",
        none: "Nenhum",
        noBlocks: "Nenhum bloco de rotina para hoje.",
      },
      duolingo: { lessons: "Lições", noLanguages: "Nenhum idioma. Adicione nas configurações." },
      spirituality: { noPractices: "Nenhuma prática. Adicione nas configurações." },
      hobby: { activity: "Atividade", activityPlaceholder: "Violão, desenho…", minutes: "Minutos" },
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
    onboarding: {
      stepOf: "Passo {current} de {total}",
      skip: "Pular",
      back: "Voltar",
      continue: "Continuar",
      finish: "Concluir",
      save: "Salvar",
      saving: "Salvando…",
      backTo: "Voltar para {section}",
      weekdays: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
      welcome: {
        title: "Vamos configurar seu tracker",
        lead: "Alguns passos rápidos para personalizar seu check-in diário. Cerca de 5 minutos — dá para pular qualquer passo e editar depois.",
        time: "~5 min",
        items: [
          "Seu plano de treino",
          "Meta e lista de leitura",
          "Sono, rotina e idiomas",
          "Práticas espirituais",
        ],
        start: "Começar",
      },
      workout: {
        title: "Treino",
        lead: "Defina um foco e exercícios para cada dia de treino.",
        planName: "Nome do plano",
        weekday: "Dia",
        focus: "Foco",
        focusPlaceholder: "Peito + tríceps, Perna, Descanso…",
        exercises: "Exercícios",
        exerciseName: "Exercício",
        sets: "Séries",
        reps: "Reps",
        kindReps: "Reps",
        kindTime: "Tempo",
        kindDistance: "Distância",
        seconds: "Segundos",
        distance: "km",
        minutes: "Minutos",
        measuredBy: "Medido por",
        addExercise: "Adicionar exercício",
        removeExercise: "Remover exercício",
        addDay: "Adicionar dia",
        removeDay: "Remover",
        exerciseCount: "{n} exercício",
        exerciseCountPlural: "{n} exercícios",
        empty: "Nenhum dia de treino ainda.",
      },
      reading: {
        title: "Leitura",
        lead: "Defina uma meta anual e sua lista de leitura.",
        goal: "Livros no ano",
        goalUnit: "livros",
        list: "Lista de leitura",
        bookTitle: "Título",
        author: "Autor",
        pages: "Páginas",
        currentPage: "Página atual",
        reading: "Lendo agora",
        addBook: "Adicionar livro",
        removeBook: "Remover",
        moveUp: "Mover para cima",
        moveDown: "Mover para baixo",
        booksCount: "{added} de {goal} livros adicionados",
        booksRemaining: "Adicione mais {n} para alcançar sua meta",
        goalReachedPre: "Essa é a sua meta completa.",
        goalReachedLink: "Quer ler mais que {goal}?",
        paceNote:
          "Com esta lista, você precisa de cerca de {pages} páginas/dia para terminar tudo até o fim de {year}.",
        paceExplainTitle: "Como esta conta é feita",
        paceExplainText:
          "As páginas que faltam no livro atual, mais todas as páginas dos livros seguintes, divididas pelos dias restantes do ano.",
        paceExplainClose: "Entendi",
        paceExplainAria: "Como o ritmo é calculado",
        empty: "Nenhum livro ainda.",
      },
      sleep: {
        title: "Sono",
        lead: "O horário-alvo de dormir e acordar define o padrão do registro diário de sono.",
        bedtime: "Dormir",
        wake: "Acordar",
      },
      routine: {
        title: "Rotina",
        lead: "Seus blocos de horário — o check diário mede o quanto você os seguiu.",
        start: "Início",
        end: "Fim",
        activity: "Atividade",
        activityPlaceholder: "Foco, Academia, Almoço…",
        weekdays: "Dias",
        addBlock: "Adicionar bloco",
        removeBlock: "Remover",
        empty: "Nenhum bloco ainda.",
      },
      duolingo: {
        title: "Duolingo",
        lead: "Quais idiomas você está aprendendo?",
        language: "Idioma",
        languagePlaceholder: "Inglês, Italiano…",
        addLanguage: "Adicionar idioma",
        removeLanguage: "Remover",
        empty: "Nenhum idioma ainda.",
      },
      spirituality: {
        title: "Espiritualidade",
        lead: "Suas práticas. As contáveis (como terços) ganham um número diário.",
        name: "Prática",
        countable: "Contável",
        addPractice: "Adicionar prática",
        removePractice: "Remover",
        empty: "Nenhuma prática ainda.",
      },
      review: {
        title: "Tudo pronto",
        lead: "Isto é o que você configurou. Dá para mudar tudo depois nas configurações.",
        notSet: "Não definido",
        sections: {
          workout: "Treino",
          reading: "Leitura",
          sleep: "Sono",
          routine: "Rotina",
          duolingo: "Duolingo",
          spirituality: "Espiritualidade",
        },
      },
      config: {
        eyebrow: "Configurações",
        title: "Configuração",
        lead: "Edite qualquer área que você configurou no onboarding.",
        edit: "Editar",
      },
      unsaved: {
        title: "Alterações não salvas",
        text: "Você mudou coisas aqui e não salvou. Voltar vai descartar tudo.",
        keepEditing: "Continuar editando",
        leave: "Descartar e voltar",
      },
    },
  },
};
