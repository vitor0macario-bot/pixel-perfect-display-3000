// VIVA domain logic: quiz definition, plan generation, daily check-in items.
// Positioning: organização e acompanhamento de hábitos. Nada de promessas de
// saúde, emagrecimento, diagnóstico ou tratamento.

export type QuizOption = { value: string; label: string };

export type QuizQuestion = {
  id: string;
  title: string;
  hint?: string;
  multiple?: boolean;
  options: QuizOption[];
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "objetivo",
    title: "Qual é o seu principal objetivo de bem-estar agora?",
    hint: "Escolha o que faz mais sentido para este momento.",
    options: [
      { value: "energia", label: "Ter mais energia no dia" },
      { value: "rotina", label: "Organizar melhor minha rotina" },
      { value: "movimento", label: "Me movimentar com mais frequência" },
      { value: "alimentacao", label: "Manter uma alimentação mais equilibrada" },
      { value: "sono", label: "Cuidar do meu sono e das pausas" },
    ],
  },
  {
    id: "rotina",
    title: "Como é a sua rotina hoje?",
    options: [
      { value: "previsivel", label: "Bem previsível, com horários definidos" },
      { value: "variavel", label: "Varia bastante de um dia para o outro" },
      { value: "corrida", label: "Muito corrida, quase sem espaço livre" },
      { value: "flexivel", label: "Flexível, eu escolho meus horários" },
    ],
  },
  {
    id: "tempo",
    title: "Quanto tempo você consegue dedicar por dia?",
    options: [
      { value: "10", label: "Até 10 minutos" },
      { value: "20", label: "Cerca de 20 minutos" },
      { value: "40", label: "Cerca de 40 minutos" },
      { value: "60", label: "1 hora ou mais" },
    ],
  },
  {
    id: "atividade",
    title: "Como você descreveria seu nível de atividade atual?",
    options: [
      { value: "parado", label: "Passo a maior parte do dia sentado" },
      { value: "leve", label: "Me movimento de vez em quando" },
      { value: "moderado", label: "Faço atividades algumas vezes por semana" },
      { value: "ativo", label: "Sou bem ativo na maioria dos dias" },
    ],
  },
  {
    id: "alimentacao",
    title: "Quais preferências alimentares você tem?",
    hint: "Pode escolher mais de uma.",
    multiple: true,
    options: [
      { value: "sem_restricao", label: "Sem restrições" },
      { value: "vegetariano", label: "Vegetariano" },
      { value: "vegano", label: "Vegano" },
      { value: "sem_lactose", label: "Evito lactose" },
      { value: "sem_gluten", label: "Evito glúten" },
      { value: "pratico", label: "Prefiro refeições práticas" },
    ],
  },
  {
    id: "habitos",
    title: "Quais hábitos você quer melhorar primeiro?",
    hint: "Escolha até três.",
    multiple: true,
    options: [
      { value: "hidratacao", label: "Beber mais água" },
      { value: "movimento", label: "Movimentar o corpo" },
      { value: "refeicoes", label: "Organizar as refeições" },
      { value: "pausas", label: "Fazer pausas ao longo do dia" },
      { value: "sono", label: "Ter uma rotina de sono" },
      { value: "tela", label: "Reduzir tempo de tela à noite" },
    ],
  },
  {
    id: "horarios",
    title: "Em que momento do dia você tem mais espaço livre?",
    multiple: true,
    options: [
      { value: "manha", label: "Manhã" },
      { value: "tarde", label: "Tarde" },
      { value: "noite", label: "Noite" },
    ],
  },
  {
    id: "dificuldade",
    title: "O que mais atrapalha sua consistência?",
    options: [
      { value: "tempo", label: "Falta de tempo" },
      { value: "motivacao", label: "Perco a motivação no meio do caminho" },
      { value: "esquecimento", label: "Esqueço de fazer" },
      { value: "comeco", label: "Não sei por onde começar" },
      { value: "cansaco", label: "Chego cansado no fim do dia" },
    ],
  },
];

export type QuizAnswers = Record<string, string | string[]>;

export const CHECKIN_ITEMS = [
  { id: "hidratacao", label: "Hidratação" },
  { id: "refeicao", label: "Refeição equilibrada" },
  { id: "movimento", label: "Movimento" },
  { id: "pausa", label: "Pausa/relaxamento" },
  { id: "sono", label: "Rotina de sono" },
] as const;

export type Period = "manha" | "tarde" | "noite";
export type Category = "rotina" | "alimentacao" | "movimento" | "habitos";

export const PERIOD_LABEL: Record<Period, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  rotina: "Rotina",
  alimentacao: "Alimentação",
  movimento: "Movimento",
  habitos: "Hábitos",
};

export type GeneratedTask = {
  period: Period;
  category: Category;
  title: string;
  description: string;
  time_of_day: string | null;
  duration_min: number;
  sort_order: number;
};

function asArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Gera a rotina inicial exclusivamente a partir das respostas do quiz.
 */
export function generatePlan(answers: QuizAnswers): GeneratedTask[] {
  const minutes = Number(answers["tempo"] ?? 20) || 20;
  const objetivo = String(answers["objetivo"] ?? "rotina");
  const atividade = String(answers["atividade"] ?? "leve");
  const dificuldade = String(answers["dificuldade"] ?? "tempo");
  const habitos = asArray(answers["habitos"]);
  const food = asArray(answers["alimentacao"]);
  const windows = asArray(answers["horarios"]);
  const main: Period = (windows[0] as Period) ?? "manha";

  const block = Math.max(5, Math.round(minutes / 3));
  const tasks: GeneratedTask[] = [];
  const push = (task: Omit<GeneratedTask, "sort_order">) =>
    tasks.push({ ...task, sort_order: tasks.length });

  // Manhã — abertura do dia
  push({
    period: "manha",
    category: "rotina",
    title: "Abrir o dia com intenção",
    description:
      dificuldade === "comeco"
        ? "Escolha uma única prioridade de bem-estar para hoje e anote em uma linha."
        : "Revise rapidamente como quer organizar seu dia e qual é o seu foco.",
    time_of_day: "07:00",
    duration_min: 5,
  });

  if (habitos.includes("hidratacao") || objetivo === "energia") {
    push({
      period: "manha",
      category: "habitos",
      title: "Primeiro copo de água",
      description: "Deixe um copo ou garrafa por perto e beba ao começar o dia.",
      time_of_day: "07:15",
      duration_min: 2,
    });
  }

  const veg = food.includes("vegano") || food.includes("vegetariano");
  push({
    period: "manha",
    category: "alimentacao",
    title: food.includes("pratico") ? "Café da manhã prático" : "Café da manhã com calma",
    description: veg
      ? "Monte uma refeição de origem vegetal que você já goste, com uma fonte de proteína vegetal e uma fruta."
      : "Monte uma refeição simples com uma fonte de proteína e uma fruta que você goste.",
    time_of_day: "08:00",
    duration_min: 15,
  });

  // Movimento — depende do nível atual e do tempo disponível
  const movePeriod: Period = windows.includes("manha") ? "manha" : main;
  push({
    period: movePeriod,
    category: "movimento",
    title:
      atividade === "parado"
        ? "Caminhada curta e leve"
        : atividade === "ativo"
          ? "Sessão de movimento que você já pratica"
          : "Movimento do dia",
    description:
      atividade === "parado"
        ? `Comece com ${Math.min(15, Math.max(8, block))} minutos de caminhada em ritmo confortável.`
        : `Reserve ${Math.max(10, block)} minutos para se movimentar de um jeito que você curta.`,
    time_of_day: movePeriod === "manha" ? "09:00" : movePeriod === "tarde" ? "15:00" : "19:00",
    duration_min: Math.max(10, block),
  });

  // Tarde
  push({
    period: "tarde",
    category: "alimentacao",
    title: "Refeição equilibrada",
    description: food.includes("sem_lactose")
      ? "Monte o prato com vegetais, uma fonte de proteína e carboidrato, sem itens com lactose."
      : food.includes("sem_gluten")
        ? "Monte o prato com vegetais, proteína e uma opção sem glúten."
        : "Monte o prato com vegetais, uma fonte de proteína e um carboidrato.",
    time_of_day: "12:30",
    duration_min: 30,
  });

  if (habitos.includes("pausas") || dificuldade === "cansaco" || objetivo === "energia") {
    push({
      period: "tarde",
      category: "habitos",
      title: "Pausa de respiro",
      description: "Levante, alongue e respire fundo por alguns minutos longe da tela.",
      time_of_day: "16:00",
      duration_min: 5,
    });
  }

  if (habitos.includes("hidratacao")) {
    push({
      period: "tarde",
      category: "habitos",
      title: "Hidratação da tarde",
      description: "Complete mais um copo de água antes do fim da tarde.",
      time_of_day: "17:00",
      duration_min: 2,
    });
  }

  // Noite
  push({
    period: "noite",
    category: "alimentacao",
    title: "Jantar sem pressa",
    description: veg
      ? "Prefira uma refeição vegetal leve e que caiba no seu tempo."
      : "Prefira uma refeição leve e que caiba no seu tempo.",
    time_of_day: "19:30",
    duration_min: 30,
  });

  if (habitos.includes("tela")) {
    push({
      period: "noite",
      category: "habitos",
      title: "Desacelerar as telas",
      description: "Escolha um horário para guardar o celular e faça algo offline antes de dormir.",
      time_of_day: "21:30",
      duration_min: 10,
    });
  }

  push({
    period: "noite",
    category: "rotina",
    title: habitos.includes("sono") || objetivo === "sono" ? "Ritual de sono" : "Fechar o dia",
    description:
      dificuldade === "esquecimento"
        ? "Marque seus check-ins do dia e prepare o que precisar para amanhã."
        : "Revise como foi o dia, sem cobrança, e prepare o ambiente para dormir.",
    time_of_day: "22:00",
    duration_min: 10,
  });

  return tasks.map((task, index) => ({ ...task, sort_order: index }));
}

export function planSummary(answers: QuizAnswers, tasks: GeneratedTask[]) {
  const minutes = Number(answers["tempo"] ?? 20) || 20;
  const windows = asArray(answers["horarios"]);
  const habitos = asArray(answers["habitos"]);
  const objetivoLabel =
    QUIZ_QUESTIONS[0]?.options.find((o) => o.value === answers["objetivo"])?.label ??
    "Organizar melhor minha rotina";

  return {
    objetivo: objetivoLabel,
    minutes,
    windows: windows.length ? windows.map((w) => PERIOD_LABEL[w as Period] ?? w) : ["Manhã"],
    habitCount: habitos.length,
    taskCount: tasks.length,
    totalMinutes: tasks.reduce((acc, t) => acc + t.duration_min, 0),
  };
}

export const QUIZ_STORAGE_KEY = "viva:quiz-answers";
export const OFFLINE_CHECKIN_KEY = "viva:pending-checkins";

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}
