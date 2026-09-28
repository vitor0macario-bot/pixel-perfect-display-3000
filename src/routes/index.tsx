import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck,
  Clock,
  Compass,
  LineChart,
  ListChecks,
  RefreshCcw,
  Sparkles,
  Target,
  History,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import appPreview from "@/assets/app-preview.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VIVA — uma rotina de bem-estar feita para você" },
      {
        name: "description",
        content:
          "Responda algumas perguntas, descubra uma rotina personalizada de hábitos, alimentação e movimento e acompanhe sua evolução todos os dias.",
      },
      { property: "og:title", content: "VIVA — uma rotina de bem-estar feita para você" },
      {
        property: "og:description",
        content:
          "Rotina personalizada, check-in diário e acompanhamento de progresso em um só lugar.",
      },
    ],
  }),
  component: Landing,
});

const problems = [
  { icon: Compass, title: "Não saber por onde começar", text: "Muita informação e nenhum primeiro passo claro." },
  { icon: Clock, title: "Falta de tempo", text: "A rotina cheia sempre empurra o autocuidado para depois." },
  { icon: RefreshCcw, title: "Começar e abandonar", text: "Uma semana animada, na outra tudo volta ao normal." },
  { icon: ListChecks, title: "Falta de organização", text: "Sem um lugar para acompanhar, tudo se perde." },
  { icon: Target, title: "Dificuldade para manter hábitos", text: "Metas grandes demais para o dia real." },
];

const steps = [
  { n: "01", title: "Conte como é sua rotina.", text: "Um quiz rápido sobre seus objetivos, horários e preferências." },
  { n: "02", title: "Receba seu plano personalizado.", text: "Uma rotina de manhã, tarde e noite montada com suas respostas." },
  { n: "03", title: "Acompanhe seu progresso todos os dias.", text: "Check-in diário, sequência e histórico simples de acompanhar." },
];

const benefits = [
  { icon: CalendarCheck, title: "Rotina personalizada", text: "Manhã, tarde e noite com atividades no seu tempo disponível." },
  { icon: ListChecks, title: "Acompanhamento diário", text: "Marque o que concluiu e veja a porcentagem do dia." },
  { icon: Target, title: "Metas semanais", text: "Objetivos pequenos e possíveis, sem cobrança." },
  { icon: History, title: "Histórico", text: "Veja sua consistência ao longo das semanas." },
  { icon: Sparkles, title: "VIVA AI", text: "Converse e reorganize seu dia quando a rotina mudar." },
  { icon: LineChart, title: "Ajustes da rotina", text: "Sua rotina acompanha o momento em que você está." },
];

const faq = [
  {
    q: "O VIVA promete perda de peso ou resultados de saúde?",
    a: "Não. O VIVA é uma ferramenta de organização e acompanhamento de hábitos e bem-estar. Não fazemos promessas de emagrecimento, cura ou resultados garantidos.",
  },
  {
    q: "O VIVA substitui médico ou nutricionista?",
    a: "Não. O VIVA não diagnostica, não prescreve e não substitui profissionais de saúde. Para questões clínicas, procure um profissional.",
  },
  {
    q: "Quanto tempo preciso por dia?",
    a: "Você escolhe no quiz: de 10 minutos a mais de uma hora. A rotina é montada dentro do tempo que você informou.",
  },
  { q: "Preciso pagar para começar?", a: "Não. O plano Free inclui quiz, plano inicial, check-in e progresso básico." },
  { q: "Posso mudar minha rotina depois?", a: "Sim. Você pode refazer o quiz e ajustar sua rotina quando quiser." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="font-display text-lg font-semibold tracking-[0.2em]">
            VIVA
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              to="/planos"
              className="hidden rounded-full px-4 py-2 text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Planos
            </Link>
            <Link
              to="/auth"
              className="rounded-full px-4 py-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              Entrar
            </Link>
            <Link
              to="/quiz"
              className="rounded-full bg-gradient-primary px-4 py-2 font-semibold text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5"
            >
              Criar meu plano
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-hero-glow">
        <div className="mx-auto grid max-w-6xl gap-14 px-5 py-20 md:py-28 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div className="rise-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-4 py-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              Personalização por IA
            </span>
            <h1 className="mt-6 font-display text-4xl leading-[1.05] font-semibold sm:text-5xl lg:text-6xl">
              Uma rotina de bem-estar <span className="text-gradient">feita para você.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Responda algumas perguntas, descubra uma rotina personalizada e acompanhe sua evolução
              todos os dias.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/quiz"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-primary px-7 py-3.5 font-semibold text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5"
              >
                Criar meu plano
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/planos"
                className="inline-flex items-center justify-center rounded-full border border-border bg-surface/60 px-7 py-3.5 font-medium transition-colors hover:bg-surface-strong"
              >
                Ver planos
              </Link>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Ferramenta de organização de hábitos e bem-estar. Não substitui acompanhamento
              profissional.
            </p>
          </div>

          <div className="fade-in-soft">
            <div className="panel overflow-hidden p-3">
              <img
                src={appPreview}
                alt="Demonstração do aplicativo VIVA com rotina e progresso diário"
                width={1280}
                height={1024}
                className="w-full rounded-2xl object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Problema */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="max-w-2xl font-display text-3xl font-semibold sm:text-4xl">
          O difícil não é querer. É manter.
        </h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Estas são as dificuldades mais comuns de quem tenta cuidar da rotina.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {problems.map((item) => (
            <div key={item.title} className="panel p-6">
              <item.icon className="size-5 text-primary" />
              <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section className="border-y border-border/60 bg-surface/30">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">Como funciona</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.n} className="panel p-7">
                <span className="font-display text-sm tracking-[0.3em] text-primary">{step.n}</span>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">
          Tudo em um só lugar, sem complicação
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((item) => (
            <div key={item.title} className="panel p-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft/60">
                <item.icon className="size-5 text-primary" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 pb-20">
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">Perguntas frequentes</h2>
        <Accordion type="single" collapsible className="mt-8">
          {faq.map((item) => (
            <AccordionItem key={item.q} value={item.q} className="border-border">
              <AccordionTrigger className="text-left text-base">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="panel bg-hero-glow px-6 py-14 text-center sm:px-14">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">
            Comece pelo seu próximo dia.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Leva poucos minutos para montar sua rotina personalizada e começar a acompanhar.
          </p>
          <Link
            to="/quiz"
            className="mt-9 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-primary px-8 py-3.5 font-semibold text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5"
          >
            Criar meu plano
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/60 px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display tracking-[0.2em] text-foreground">VIVA</span>
          <p className="max-w-xl">
            O VIVA é uma ferramenta de organização e acompanhamento de hábitos e bem-estar. Não
            realiza diagnóstico, não prescreve tratamentos e não substitui médico, nutricionista ou
            outro profissional de saúde.
          </p>
        </div>
      </footer>
    </div>
  );
}
