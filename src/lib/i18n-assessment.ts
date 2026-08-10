// Copy for the values layer, kept in its own module and folded into COPY by
// i18n.ts. It imports nothing from there, so the dependency runs one way only.
//
// The rule this file exists to serve: every question says why it is being
// asked, in one line, in words that assume no psychology. The instrument is
// clinical in origin. The copy must not be, or people abandon it on screen
// four, and a grid nobody finishes measures nothing.
//
// Two things this copy may never do. It may never grade a person: a 3 in
// community life can be perfectly healthy, and the moment a low answer reads
// as a bad answer people start producing the right number instead of the true
// one. And it may never read an emotional state off a number: the grid is
// self-report, not diagnosis.
import type { Pattern } from "./diagnose";
import type { DomainSlug, ScaleKey } from "./domains";

interface ScaleCopy {
  label: string;
  question: string;
  // The one line that earns the answer.
  why: string;
  lowAnchor: string;
  highAnchor: string;
}

interface DomainCopy {
  name: string;
  description: string;
  // What does NOT belong here. The worksheet is emphatic that the areas must
  // not bleed into each other, and "family" against "partner" against
  // "children" is where it happens.
  boundary: string;
  // The writing prompt, used when this domain reaches the directions step.
  prompt: string;
}

interface PatternCopy {
  name: string;
  // The same finding split into the two columns the results table shows.
  // `action` is null where a pattern makes only one claim (BLIND_SPOT says
  // nothing about action separately), and that row spans both columns rather
  // than inventing a second clause to fill it.
  importance: string;
  action: string | null;
  means: string;
  next: string;
}

export interface AssessmentCopy {
  navLabel: string;
  back: string;
  continueLabel: string;
  saving: string;

  intro: {
    eyebrow: string;
    title: string;
    lead: string;
    time: string;
    items: string[];
    itemsTitle: string;
    notApplicable: string;
    // The clinical-origin note, split so the component can wrap a real link
    // around the technique's name. Copy crosses into Client Components, so it
    // can never carry JSX.
    funFactTitle: string;
    cautionBefore: string;
    cautionLink: string;
    cautionAfter: string;
    cautionHref: string;
    start: string;
  };

  resume: {
    title: string;
    lead: string; // {date} {done} {total}
    resumeAction: string;
    restartAction: string;
    restartNote: string;
  };

  domainStep: {
    eyebrow: string; // {current} {total}
    boundaryLabel: string;
    whyLabel: string;
    unanswered: string;
    remaining: string; // {n}
    remainingOne: string; // {n}
    finish: string;
  };

  scaleValue: string; // {value}
  scaleRange: string; // {low} {high}
  scaleUnanswered: string;
  scales: Record<ScaleKey, ScaleCopy>;
  domains: Record<DomainSlug, DomainCopy>;
  patterns: Record<Pattern, PatternCopy>;

  results: {
    eyebrow: string;
    title: string;
    lead: string;
    takenOn: string; // {date}
    chartTitle: string;
    chartLead: string;
    importanceLabel: string;
    actionLabel: string;
    gapLabel: string; // {n}
    gapNone: string;
    gapInverted: string; // {n}
    scoreOutOf: string; // {n}
    colArea: string;
    colImportance: string;
    colAction: string;
    findingsTitle: string;
    findingsFirst: string;
    findingsRest: string;
    noFindings: string;
    priorityTitle: string;
    priorityLead: string;
    narrowSpread: string;
    fewerThanFive: string;
    writeDirections: string;
    reviewDirections: string;
    backHome: string;
  };

  directions: {
    eyebrow: string; // {current} {total}
    title: string;
    lead: string;
    reflectionLabel: string;
    reflectionHelp: string;
    narrativeLabel: string;
    narrativeHelp: string;
    narrativePlaceholder: string;
    save: string;
    finish: string;
    doneTitle: string;
    doneLead: string;
    doneAction: string;
    indexTitle: string;
    indexLead: string;
    indexEdit: string;
    indexEmpty: string;
  };

  card: {
    eyebrow: string;
    emptyTitle: string;
    emptyLead: string;
    emptyAction: string;
    draftTitle: string;
    draftLead: string; // {date} {done} {total}
    draftAction: string;
    doneTitle: string;
    doneLead: string; // {date}
    doneAction: string;
    doneSubtitle: string;
    relevantAreas: string;
  };
}

const en: AssessmentCopy = {
  navLabel: "Values",
  back: "Back",
  continueLabel: "Continue",
  saving: "Saving…",

  intro: {
    eyebrow: "Values check-in",
    title: "What matters, and what you actually do",
    lead: "Twelve areas of life, six quick questions about each. The result is a map of where the two have drifted apart.",
    time: "About 20 minutes. One area per screen.",
    items: [
      "There are no right answers and no total at the end. A low answer can be a perfectly healthy one.",
      "Every question says why it is being asked. Read that line if the question feels odd.",
      "You can stop anywhere. Whatever you have answered is kept.",
    ],
    itemsTitle: "About the questions",
    notApplicable:
      "If an area is not part of your life right now, that is a real answer. Rate its importance low and move on.",
    funFactTitle: "Where this comes from",
    cautionBefore: "These twelve areas are the values worksheet from ",
    cautionLink: "Acceptance and Commitment Therapy",
    cautionAfter:
      ", used here for planning rather than therapy. If an area opens something heavy, that is a sign to talk to a person, not to fill in another box.",
    cautionHref: "https://contextualscience.org/act",
    start: "Start",
  },

  resume: {
    title: "You already started this one",
    lead: "Begun on {date}, with {done} of {total} areas answered. A check-in is meant to be one sitting, so picking it up much later mixes two different weeks.",
    resumeAction: "Pick it back up",
    restartAction: "Start fresh from today",
    restartNote: "Starting fresh discards the unfinished answers. Nothing you have already finished is affected.",
  },

  domainStep: {
    eyebrow: "Area {current} of {total}",
    boundaryLabel: "What does not go here",
    whyLabel: "Why we ask",
    unanswered: "Not answered",
    remaining: "{n} questions still to answer.",
    remainingOne: "{n} question still to answer.",
    finish: "See the results",
  },

  scaleValue: "{value} of 10",
  scaleRange: "Scale from {low} to {high}.",
  scaleUnanswered: "Not answered yet. Drag or use the arrow keys.",

  scales: {
    possibility: {
      label: "Possibility",
      question: "How possible does real change feel here?",
      why: "Areas that feel hopeless get dropped from planning before you notice you dropped them. Naming it now keeps this one on the table.",
      lowAnchor: "feels closed",
      highAnchor: "wide open",
    },
    importanceNow: {
      label: "Importance now",
      question: "How much is this area on your mind at the moment?",
      why: "This is about your attention this month, not about your values. Plenty of things matter deeply and still are not where your head is.",
      lowAnchor: "not on my mind",
      highAnchor: "front of mind",
    },
    importanceGeneral: {
      label: "Importance overall",
      question: "Setting this moment aside, how much does this matter in the life you want?",
      why: "This is the steady one. It should barely move from year to year, which is exactly what makes it the line everything else gets measured against.",
      lowAnchor: "does not matter to me",
      highAnchor: "matters enormously",
    },
    action: {
      label: "Action",
      question: "Over the last week, how much did you actually do here?",
      why: "Not what you planned or meant to do, but what happened. The distance between this and the answer above is the whole point of the exercise.",
      lowAnchor: "nothing",
      highAnchor: "a lot",
    },
    actionSatisfaction: {
      label: "Satisfaction",
      question: "How satisfied are you with what you did here?",
      why: "You can put a great deal into an area and still feel it was the wrong kind of doing. A low answer under a high one usually means the effort is going somewhere that is not yours.",
      lowAnchor: "not at all",
      highAnchor: "completely",
    },
    concern: {
      label: "Concern",
      question: "How much do you worry about this area?",
      why: "Worry and action come apart more often than people expect. Where you worry a lot and act a little, the worry is doing the work instead of you.",
      lowAnchor: "never",
      highAnchor: "constantly",
    },
  },

  domains: {
    family: {
      name: "Family",
      description: "The family you came from and the family you chose. Parents, siblings, cousins, whoever counts as family to you.",
      boundary: "Not your partner and not your children. Each of those has its own area.",
      prompt: "What kind of son, brother or relative do you want to be? Describe how you would treat these people at your best.",
    },
    couple: {
      name: "Partnership",
      description: "Your intimate relationship, and the person you want to be inside one.",
      boundary: "Your part in the relationship, not the logistics you share and not raising children together.",
      prompt: "Describe the partner you want to be. If you are not in a relationship, describe the one you would want and your part in it.",
    },
    parenting: {
      name: "Parenting",
      description: "Raising children, now or one day.",
      boundary: "The relationship you want with them, not the schedule. If this is not part of your life, rate its importance low and move on.",
      prompt: "What kind of parent do you want to be, now and in the future?",
    },
    friends: {
      name: "Friendships",
      description: "Friendships and social life.",
      boundary: "Colleagues belong here only if they are genuinely friends.",
      prompt: "What does being a good friend mean to you? Describe how you would act toward your friends at your best.",
    },
    work: {
      name: "Work",
      description: "Career and employment. What you do for a living, and how you do it.",
      boundary: "What you already do, not what you are learning to do next. That is Growth.",
      prompt: "Describe the work you would want in an ideal world, why it appeals to you, and the kind of colleague you want to be.",
    },
    education: {
      name: "Growth",
      description: "Study, training, and growing as a person.",
      boundary: "Learning as its own end, separate from getting ahead at work.",
      prompt: "What would you want to learn or train in, and why does that pull at you?",
    },
    recreation: {
      name: "Fun and rest",
      description: "Hobbies, sport, play, and rest that actually restores you.",
      boundary: "Rest that gives something back, not the collapse at the end of a depleted day.",
      prompt: "What would your recreational life look like? Hobbies, sport, the way you would spend free time.",
    },
    spirituality: {
      name: "Spirituality",
      description: "Whatever the word means to you. Religion, nature, meaning, practice. Any of it counts.",
      boundary: "Your own practice and sense of meaning. Belonging to a group is Community.",
      prompt: "How would you want this part of your life to be?",
    },
    community: {
      name: "Community",
      description: "Civic life, volunteering, belonging to something larger than you.",
      boundary: "Contributing, not socialising. If this is not part of your life right now, rate its importance low.",
      prompt: "What direction would you want to take here? Causes, volunteering, the group you would want to be part of.",
    },
    health: {
      name: "Health",
      description: "Your body and how you look after it. Sleep, movement, food, medical care.",
      boundary: "The care itself, not how you look.",
      prompt: "What do you value about looking after yourself physically?",
    },
    environment: {
      name: "Environment",
      description: "Your relationship with nature and with the planet.",
      boundary: "Both what you do about it and what you care about.",
      prompt: "What matters to you about sustainability and the natural world?",
    },
    art: {
      name: "Art",
      description: "Art, music, writing, craft. Making it or taking it in.",
      boundary: "Both count, what you make and what you love that others made.",
      prompt: "What forms of beauty matter to you, and what would you want your relationship with them to be?",
    },
  },

  patterns: {
    LIVING_GAP: {
      name: "Matters a lot. Barely happening.",
      importance: "Matters a lot",
      action: "Barely happening",
      means: "You put this among the things you care most about, and among the things you did least last week.",
      next: "This is the most common distance there is, and the most workable. Pick the smallest action that would count, then make it smaller.",
    },
    EMPTY_ACTION: {
      name: "Plenty of doing. Little to show for it.",
      importance: "Plenty of doing",
      action: "Little to show for it",
      means: "You put real effort into this area and came away unsatisfied with it.",
      next: "Usually the effort is going somewhere that is not yours. Worth asking what you would do here if nobody were watching.",
    },
    HOPELESSNESS: {
      name: "Matters a lot. Feels closed.",
      importance: "Matters a lot",
      action: "Feels closed",
      means: "You care about this and do not believe much can change here.",
      next: "Whatever you plan next, this area gets dropped quietly unless the belief moves first. Look for the smallest piece of it that is not closed.",
    },
    ANXIETY_NO_ACTION: {
      name: "On your mind. Not in your week.",
      importance: "On your mind",
      action: "Not in your week",
      means: "This worries you more than most areas, and you acted on it less than most.",
      next: "Worry can stand in for action for years. One concrete step, however small, usually costs less than another week of thinking about it.",
    },
    POSTPONED: {
      name: "Important in general. Parked for now.",
      importance: "Important in general",
      action: "Parked for now",
      means: "You rate this highly for the life you want, and low for what is on your mind this month.",
      next: "That can be a fair call, since not everything belongs in every season. Worth knowing whether you chose it or it just happened.",
    },
    AUTOPILOT: {
      name: "A lot of your week. Not much of your life.",
      importance: "A lot of your week",
      action: "Not much of your life",
      means: "You act here more than the area matters to you.",
      next: "Some of that is unavoidable. Some of it is time that could go to something at the top of this list.",
    },
    BLIND_SPOT: {
      name: "Every answer here is low.",
      importance: "Every answer here is low",
      action: null,
      means: "Nothing in this area registered. Not importance, not action, not worry.",
      next: "Sometimes that is an area you have not looked at in a while. Sometimes it is one that honestly is not yours right now. Only you can tell which, and both are fine answers.",
    },
  },

  results: {
    eyebrow: "Your check-in",
    title: "Where the distances are",
    lead: "Nothing here is a score. The number worth reading is the distance between what you said matters and what you said you did.",
    takenOn: "Taken on {date}",
    chartTitle: "Importance against action",
    chartLead:
      "Two answers per area: how much it matters in the life you want, and how much you actually did last week. The distance between the two bars is the point.",
    importanceLabel: "Importance",
    actionLabel: "Action",
    gapLabel: "{n} apart",
    gapNone: "no distance",
    gapInverted: "{n} past it",
    scoreOutOf: "{n}/10",
    colArea: "Area",
    colImportance: "Importance",
    colAction: "Action",
    findingsTitle: "What stands out",
    findingsFirst: "Worth reading first",
    findingsRest: "Everything else that crossed a line",
    noFindings:
      "Nothing crossed a threshold this time. That is a real result, not an empty one.",
    priorityTitle: "The five to work on",
    priorityLead:
      "The widest distances in areas that matter to you. Five, because a cycle with eight goals is a cycle with none.",
    narrowSpread:
      "Your distances are close together this time. The order below is real, but the cut at five is somewhat arbitrary.",
    fewerThanFive:
      "Fewer than five areas came through. That is the honest result of your own answers, and the list is not padded to fill a number.",
    writeDirections: "Write your directions",
    reviewDirections: "Review your directions",
    backHome: "Back to the app",
  },

  directions: {
    eyebrow: "Direction {current} of {total}",
    title: "Where do you want to move here?",
    lead: "A direction is not a goal. A goal can be finished, a direction never is, and that is what makes it worth having.",
    reflectionLabel: "Think it through",
    reflectionHelp:
      "Write for yourself. Nobody reads this, and it exists to get the sentence below out of you.",
    narrativeLabel: "In one sentence, the direction",
    narrativeHelp:
      "This is the sentence you will see on a hard Tuesday, so write it for that version of you.",
    narrativePlaceholder: "I want to move toward…",
    save: "Save and continue",
    finish: "Finish",
    doneTitle: "Cycle set",
    doneLead:
      "Your answers are sealed and will not change. When you come back to this in six months, what you see will be what you actually said.",
    doneAction: "See the results",
    indexTitle: "Your directions",
    indexLead:
      "One sentence per area, for the days when the reason is hard to remember. Edit any of them whenever the wording stops being true.",
    indexEdit: "Edit",
    indexEmpty: "Not written yet",
  },

  card: {
    eyebrow: "Values",
    emptyTitle: "You have not taken the values check-in",
    emptyLead:
      "Twelve areas of life, six quick questions about each, about 20 minutes. It shows where what you care about and what you actually do have drifted apart.",
    emptyAction: "Start the check-in",
    draftTitle: "Values check-in in progress",
    draftLead: "Started {date}, {done} of {total} areas answered",
    draftAction: "Pick it back up",
    doneTitle: "Values check-in",
    doneLead: "Taken on {date}",
    doneAction: "See the results",
    doneSubtitle:
      "A read of your values, to help you set goals and build everyday habits.",
    relevantAreas: "Areas that matter",
  },
};

const pt: AssessmentCopy = {
  navLabel: "Valores",
  back: "Voltar",
  continueLabel: "Continuar",
  saving: "Salvando…",

  intro: {
    eyebrow: "Check-in de valores",
    title: "O que importa, e o que você faz de verdade",
    lead: "Doze áreas da vida, seis perguntas rápidas sobre cada uma. No fim, um mapa de onde as duas coisas se afastaram.",
    time: "Cerca de 20 minutos. Uma área por tela.",
    items: [
      "Não existe resposta certa nem nota no final. Uma resposta baixa pode ser perfeitamente saudável.",
      "Toda pergunta diz por que está sendo feita. Leia essa linha se a pergunta parecer estranha.",
      "Você pode parar onde quiser. O que já respondeu fica salvo.",
    ],
    itemsTitle: "Sobre as perguntas",
    notApplicable:
      "Se uma área não faz parte da sua vida agora, isso é uma resposta de verdade. Dê uma importância baixa e siga em frente.",
    funFactTitle: "De onde isso vem",
    cautionBefore: "Estas doze áreas são a folha de valores da ",
    cautionLink: "Terapia de Aceitação e Compromisso",
    cautionAfter:
      ", usada aqui para planejamento, não para terapia. Se alguma área abrir algo que pesa, isso é sinal de conversa com gente, não de mais um campo preenchido.",
    cautionHref: "https://contextualscience.org/act",
    start: "Começar",
  },

  resume: {
    title: "Você já tinha começado esse",
    lead: "Começado em {date}, com {done} de {total} áreas respondidas. O check-in foi feito para ser uma sentada só, então retomar muito depois mistura duas semanas diferentes.",
    resumeAction: "Retomar de onde parei",
    restartAction: "Começar de novo, a partir de hoje",
    restartNote: "Começar de novo descarta as respostas inacabadas. Nada do que você já finalizou é afetado.",
  },

  domainStep: {
    eyebrow: "Área {current} de {total}",
    boundaryLabel: "O que não entra aqui",
    whyLabel: "Por que perguntamos",
    unanswered: "Sem resposta",
    remaining: "Faltam {n} perguntas.",
    remainingOne: "Falta {n} pergunta.",
    finish: "Ver os resultados",
  },

  scaleValue: "{value} de 10",
  scaleRange: "Escala de {low} até {high}.",
  scaleUnanswered: "Ainda sem resposta. Arraste ou use as setas.",

  scales: {
    possibility: {
      label: "Possibilidade",
      question: "O quanto uma mudança de verdade parece possível aqui?",
      why: "Áreas que parecem sem saída somem do planejamento antes de você perceber que sumiram. Dizer isso agora mantém essa aqui na mesa.",
      lowAnchor: "parece fechado",
      highAnchor: "totalmente aberto",
    },
    importanceNow: {
      label: "Importância agora",
      question: "O quanto essa área está na sua cabeça neste momento?",
      why: "Aqui é sobre a sua atenção neste mês, não sobre os seus valores. Muita coisa importa demais e mesmo assim não é onde a sua cabeça está.",
      lowAnchor: "nem passa pela cabeça",
      highAnchor: "o tempo todo",
    },
    importanceGeneral: {
      label: "Importância geral",
      question: "Deixando este momento de lado, o quanto isso importa na vida que você quer?",
      why: "Essa é a resposta estável. Ela quase não muda de um ano para o outro, e é justamente por isso que serve de régua para todas as outras.",
      lowAnchor: "não me importa",
      highAnchor: "importa demais",
    },
    action: {
      label: "Ação",
      question: "Na última semana, o quanto você realmente fez aqui?",
      why: "Não o que você planejou ou pretendia fazer, mas o que aconteceu. A distância entre esta resposta e a de cima é o ponto do exercício inteiro.",
      lowAnchor: "nada",
      highAnchor: "bastante",
    },
    actionSatisfaction: {
      label: "Satisfação",
      question: "O quanto você está satisfeito com o que fez aqui?",
      why: "Dá para se dedicar muito a uma área e ainda assim sentir que foi o tipo errado de dedicação. Uma resposta baixa embaixo de uma alta costuma dizer que o esforço está indo para um lugar que não é seu.",
      lowAnchor: "nada satisfeito",
      highAnchor: "totalmente",
    },
    concern: {
      label: "Preocupação",
      question: "O quanto essa área te preocupa?",
      why: "Preocupação e ação se descolam com mais frequência do que se imagina. Onde você se preocupa muito e age pouco, a preocupação está fazendo o trabalho no seu lugar.",
      lowAnchor: "nunca",
      highAnchor: "o tempo todo",
    },
  },

  domains: {
    family: {
      name: "Família",
      description: "A família de onde você veio e a que você escolheu. Pais, irmãos, primos, quem conta como família para você.",
      boundary: "Não entra quem você ama de forma romântica, nem seus filhos. Cada um tem a sua própria área.",
      prompt: "Que tipo de filho, irmão ou parente você quer ser? Descreva como trataria essas pessoas na sua melhor versão.",
    },
    couple: {
      name: "Relacionamento",
      description: "O relacionamento íntimo, e a pessoa que você quer ser dentro de um.",
      boundary: "O seu papel na relação, não a logística que vocês dividem nem criar filhos juntos.",
      prompt: "Descreva o parceiro que você quer ser. Se não está em um relacionamento, descreva o que gostaria de ter e o seu papel nele.",
    },
    parenting: {
      name: "Parentalidade",
      description: "Criar filhos, agora ou um dia.",
      boundary: "A relação que você quer com eles, não a agenda. Se isso não faz parte da sua vida, dê uma importância baixa e siga em frente.",
      prompt: "Que tipo de pai ou mãe você quer ser, agora e no futuro?",
    },
    friends: {
      name: "Amizades",
      description: "Amizades e vida social.",
      boundary: "Colegas de trabalho entram aqui só se forem amigos de verdade.",
      prompt: "O que significa ser um bom amigo para você? Descreva como agiria com seus amigos na sua melhor versão.",
    },
    work: {
      name: "Trabalho",
      description: "Carreira e emprego. O que você faz para viver, e como faz.",
      boundary: "O que você já faz, não o que está aprendendo a fazer. Isso é Crescimento.",
      prompt: "Descreva o trabalho que gostaria de ter num mundo ideal, por que ele te atrai, e que tipo de colega você quer ser.",
    },
    education: {
      name: "Crescimento",
      description: "Estudo, formação, e crescer como pessoa.",
      boundary: "Aprender como um fim em si, separado de avançar na carreira.",
      prompt: "O que você gostaria de aprender ou estudar, e por que isso te puxa?",
    },
    recreation: {
      name: "Lazer",
      description: "Hobbies, esporte, brincadeira, e o descanso que descansa de verdade.",
      boundary: "Descanso que devolve alguma coisa, não o desabar no fim de um dia esgotado.",
      prompt: "Como seria a sua vida de lazer? Hobbies, esportes, o jeito que passaria o tempo livre.",
    },
    spirituality: {
      name: "Espiritualidade",
      description: "O que quer que a palavra signifique para você. Religião, natureza, sentido, prática. Tudo vale.",
      boundary: "A sua prática e o seu sentido. Pertencer a um grupo é Comunidade.",
      prompt: "Como você gostaria que essa parte da sua vida fosse?",
    },
    community: {
      name: "Comunidade",
      description: "Vida em comunidade, voluntariado, pertencer a algo maior que você.",
      boundary: "Contribuir, não socializar. Se isso não faz parte da sua vida agora, dê uma importância baixa.",
      prompt: "Que direção você gostaria de tomar aqui? Causas, voluntariado, o grupo do qual gostaria de fazer parte.",
    },
    health: {
      name: "Saúde",
      description: "O seu corpo e o cuidado com ele. Sono, movimento, comida, saúde.",
      boundary: "O cuidado em si, não a aparência.",
      prompt: "O que você valoriza no cuidado com o seu próprio corpo?",
    },
    environment: {
      name: "Meio ambiente",
      description: "A sua relação com a natureza e com o planeta.",
      boundary: "Vale tanto o que você faz a respeito quanto o que te importa.",
      prompt: "O que importa para você em sustentabilidade e no mundo natural?",
    },
    art: {
      name: "Arte",
      description: "Arte, música, escrita, artesanato. Fazer ou apreciar.",
      boundary: "Os dois contam, o que você faz e o que você ama que outros fizeram.",
      prompt: "Que formas de beleza importam para você, e como gostaria que fosse a sua relação com elas?",
    },
  },

  patterns: {
    LIVING_GAP: {
      name: "Importa muito. Quase não acontece.",
      importance: "Importa muito",
      action: "Quase não acontece",
      means: "Você colocou essa área entre as que mais importam e entre as que menos aconteceram na última semana.",
      next: "É a distância mais comum que existe, e a mais trabalhável. Escolha a menor ação que já contaria, e depois diminua ela.",
    },
    EMPTY_ACTION: {
      name: "Muita dedicação. Pouco retorno.",
      importance: "Muita dedicação",
      action: "Pouco retorno",
      means: "Você se dedicou de verdade a essa área e saiu insatisfeito com ela.",
      next: "Em geral o esforço está indo para um lugar que não é seu. Vale perguntar o que você faria aqui se ninguém estivesse olhando.",
    },
    HOPELESSNESS: {
      name: "Importa muito. Parece fechado.",
      importance: "Importa muito",
      action: "Parece fechado",
      means: "Você se importa com isso e não acredita que muita coisa possa mudar aqui.",
      next: "Qualquer plano que você fizer vai abandonar essa área em silêncio enquanto a crença não se mexer. Procure o menor pedaço dela que não esteja fechado.",
    },
    ANXIETY_NO_ACTION: {
      name: "Na sua cabeça. Fora da sua semana.",
      importance: "Na sua cabeça",
      action: "Fora da sua semana",
      means: "Essa área te preocupa mais que a maioria, e você agiu nela menos que na maioria.",
      next: "A preocupação consegue substituir a ação por anos. Um passo concreto, por menor que seja, costuma custar menos que mais uma semana pensando nisso.",
    },
    POSTPONED: {
      name: "Importante no geral. Guardada por enquanto.",
      importance: "Importante no geral",
      action: "Guardada por enquanto",
      means: "Você deu uma nota alta pensando na vida que quer, e uma nota baixa para o que está na sua cabeça neste mês.",
      next: "Pode ser uma escolha justa, já que nem tudo cabe em toda temporada. Vale saber se você escolheu isso ou se apenas aconteceu.",
    },
    AUTOPILOT: {
      name: "Muito da sua semana. Pouco da sua vida.",
      importance: "Muito da sua semana",
      action: "Pouco da sua vida",
      means: "Você age aqui mais do que essa área importa para você.",
      next: "Parte disso é inevitável. Parte é tempo que poderia estar em algo no topo desta lista.",
    },
    BLIND_SPOT: {
      name: "Todas as respostas aqui são baixas.",
      importance: "Todas as respostas aqui são baixas",
      action: null,
      means: "Nada nessa área registrou. Nem importância, nem ação, nem preocupação.",
      next: "Às vezes é uma área que você não olha há um tempo. Às vezes é uma que honestamente não é sua agora. Só você sabe qual, e as duas são respostas legítimas.",
    },
  },

  results: {
    eyebrow: "Seu check-in",
    title: "Onde estão as distâncias",
    lead: "Nada aqui é nota. O número que vale ler é a distância entre o que você disse que importa e o que você disse que fez.",
    takenOn: "Preenchido em {date}",
    chartTitle: "Importância contra ação",
    chartLead:
      "Duas respostas por área: o quanto ela importa na vida que você quer, e o quanto você realmente fez na última semana. A distância entre as duas barras é o ponto.",
    importanceLabel: "Importância",
    actionLabel: "Ação",
    gapLabel: "{n} de distância",
    gapNone: "sem distância",
    gapInverted: "{n} além",
    scoreOutOf: "{n}/10",
    colArea: "Área",
    colImportance: "Importância",
    colAction: "Ação",
    findingsTitle: "O que salta aos olhos",
    findingsFirst: "Vale ler primeiro",
    findingsRest: "Todo o resto que cruzou uma linha",
    noFindings:
      "Nada cruzou um limite desta vez. Isso é um resultado de verdade, não um resultado vazio.",
    priorityTitle: "As cinco para trabalhar",
    priorityLead:
      "As maiores distâncias entre as áreas que importam para você. Cinco, porque um ciclo com oito metas é um ciclo com nenhuma.",
    narrowSpread:
      "Suas distâncias estão próximas umas das outras desta vez. A ordem abaixo é real, mas o corte em cinco é um tanto arbitrário.",
    fewerThanFive:
      "Menos de cinco áreas passaram. Esse é o resultado honesto das suas próprias respostas, e a lista não é preenchida só para fechar um número.",
    writeDirections: "Escrever suas direções",
    reviewDirections: "Rever suas direções",
    backHome: "Voltar para o app",
  },

  directions: {
    eyebrow: "Direção {current} de {total}",
    title: "Para onde você quer caminhar aqui?",
    lead: "Direção não é meta. Meta se conclui, direção nunca, e é isso que a torna útil.",
    reflectionLabel: "Pense em voz alta",
    reflectionHelp:
      "Escreva para você. Ninguém lê isso, e ele existe para arrancar de você a frase de baixo.",
    narrativeLabel: "Em uma frase, a direção",
    narrativeHelp:
      "Essa é a frase que você vai ver numa terça-feira difícil, então escreva ela para aquela versão de você.",
    narrativePlaceholder: "Quero caminhar na direção de…",
    save: "Salvar e continuar",
    finish: "Concluir",
    doneTitle: "Ciclo montado",
    doneLead:
      "Suas respostas estão lacradas e não mudam mais. Quando você voltar aqui daqui a seis meses, o que estiver na tela é o que você realmente disse.",
    doneAction: "Ver os resultados",
    indexTitle: "Suas direções",
    indexLead:
      "Uma frase por área, para os dias em que o motivo é difícil de lembrar. Edite qualquer uma quando a escrita deixar de ser verdade.",
    indexEdit: "Editar",
    indexEmpty: "Ainda não escrita",
  },

  card: {
    eyebrow: "Valores",
    emptyTitle: "Você ainda não fez o check-in de valores",
    emptyLead:
      "Doze áreas da vida, seis perguntas rápidas sobre cada uma, cerca de 20 minutos. Ele mostra onde o que você valoriza e o que você faz de fato se afastaram.",
    emptyAction: "Começar o check-in",
    draftTitle: "Check-in de valores em andamento",
    draftLead: "Começado em {date}, {done} de {total} áreas respondidas",
    draftAction: "Retomar",
    doneTitle: "Check-in de valores",
    doneLead: "Preenchido em {date}",
    doneAction: "Ver os resultados",
    doneSubtitle:
      "Uma leitura dos seus valores, para ajudar a definir metas e construir hábitos do dia a dia.",
    relevantAreas: "Áreas relevantes",
  },
};

export const ASSESSMENT_COPY = { en, pt };
