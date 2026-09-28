import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { QUIZ_QUESTIONS, QUIZ_STORAGE_KEY, generatePlan, planSummary, type QuizAnswers } from "@/lib/viva";
import { useAuth } from "@/lib/auth";
import { applyQuizPlan } from "@/lib/data";
import { toast } from "sonner";

export const Route = createFileRoute("/quiz")({
  head: () => ({
    meta: [
      { title: "Quiz VIVA — monte sua rotina personalizada" },
      {
        name: "description",
        content: "Responda algumas perguntas sobre sua rotina, tempo disponível e hábitos para receber um plano personalizado.",
      },
      { property: "og:title", content: "Quiz VIVA — monte sua rotina personalizada" },
      {
        property: "og:description",
        content: "Poucos minutos para montar uma rotina de bem-estar no seu tempo.",
      },
    ],
  }),
  component: QuizPage,
});

type Stage = "questions" | "processing" | "summary";

function QuizPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [stage, setStage] = useState<Stage>("questions");
  const [saving, setSaving] = useState(false);

  const question = QUIZ_QUESTIONS[step]!;
  const total = QUIZ_QUESTIONS.length;
  const progress = Math.round(((step + (stage === "questions" ? 0 : 1)) / total) * 100);
  const current = answers[question.id];
  const selected = Array.isArray(current) ? current : current ? [current] : [];

  function select(value: string) {
    setAnswers((prev) => {
      if (question.multiple) {
        const list = Array.isArray(prev[question.id]) ? [...(prev[question.id] as string[])] : [];
        const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
        return { ...prev, [question.id]: next };
      }
      return { ...prev, [question.id]: value };
    });
    if (!question.multiple) setTimeout(() => advance(value), 180);
  }

  function advance(value?: string) {
    const answered = value ?? (selected.length ? selected[0] : undefined);
    if (!answered && selected.length === 0) return;
    if (step + 1 < total) {
      setStep(step + 1);
      return;
    }
    setStage("processing");
    setTimeout(() => setStage("summary"), 2200);
  }

  async function handleContinue() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(answers));
    }
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup" } });
      return;
    }
    setSaving(true);
    try {
      await applyQuizPlan(user.id, answers);
      window.localStorage.removeItem(QUIZ_STORAGE_KEY);
      navigate({ to: "/inicio" });
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível salvar seu plano. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (stage === "processing") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-hero-glow px-6 text-center">
        <Loader2 className="size-9 animate-spin text-primary" />
        <h1 className="mt-8 font-display text-2xl font-semibold sm:text-3xl">
          Estamos montando sua experiência personalizada...
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          Organizando sua rotina de manhã, tarde e noite com base nas suas respostas.
        </p>
      </div>
    );
  }

  if (stage === "summary") {
    const tasks = generatePlan(answers);
    const summary = planSummary(answers, tasks);
    return (
      <div className="min-h-screen bg-hero-glow px-5 py-14">
        <div className="mx-auto max-w-2xl rise-in">
          <span className="text-xs tracking-[0.3em] text-primary">SEU RESUMO</span>
          <h1 className="mt-4 font-display text-3xl font-semibold">Seu plano inicial está pronto</h1>
          <p className="mt-3 text-muted-foreground">
            Montado exclusivamente a partir das suas respostas.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <SummaryCard label="Foco principal" value={summary.objetivo} />
            <SummaryCard label="Tempo por dia" value={`${summary.minutes} min`} />
            <SummaryCard label="Momentos livres" value={summary.windows.join(", ")} />
            <SummaryCard label="Atividades na rotina" value={`${summary.taskCount} atividades`} />
          </div>

          <div className="panel mt-6 p-6">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
              PRÉVIA DA ROTINA
            </h2>
            <ul className="mt-4 space-y-3">
              {tasks.slice(0, 5).map((task) => (
                <li key={task.title} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-muted-foreground">{task.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={handleContinue}
            disabled={saving}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary px-8 py-4 font-semibold text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {user ? "Salvar meu plano" : "Criar conta e salvar plano"}
          </button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Sugestões de organização de hábitos. Não é orientação médica ou nutricional.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto w-full max-w-2xl px-5 pt-8">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <button
            onClick={() => (step === 0 ? navigate({ to: "/" }) : setStep(step - 1))}
            className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Voltar
          </button>
          <span>
            {step + 1} de {total}
          </span>
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
          <div
            className="h-full rounded-full bg-gradient-primary transition-all duration-500"
            style={{ width: `${Math.max(progress, 6)}%` }}
          />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-12">
        <div key={question.id} className="rise-in">
          <h1 className="font-display text-2xl leading-tight font-semibold sm:text-3xl">
            {question.title}
          </h1>
          {question.hint ? (
            <p className="mt-3 text-sm text-muted-foreground">{question.hint}</p>
          ) : null}

          <div className="mt-8 space-y-3">
            {question.options.map((option) => {
              const active = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => select(option.value)}
                  className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition-all ${
                    active
                      ? "border-primary bg-primary-soft/40 shadow-glow"
                      : "border-border bg-surface/60 hover:border-primary/40 hover:bg-surface-strong"
                  }`}
                >
                  <span className="text-sm font-medium sm:text-base">{option.label}</span>
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                      active ? "border-primary bg-primary" : "border-border"
                    }`}
                  >
                    {active ? <Check className="size-3 text-primary-foreground" /> : null}
                  </span>
                </button>
              );
            })}
          </div>

          {question.multiple ? (
            <button
              onClick={() => advance()}
              disabled={selected.length === 0}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary px-8 py-3.5 font-semibold text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar
              <ArrowRight className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="px-5 pb-8 text-center text-xs text-muted-foreground">
        Já tem conta?{" "}
        <Link to="/auth" className="text-primary hover:underline">
          Entrar
        </Link>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-5">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
