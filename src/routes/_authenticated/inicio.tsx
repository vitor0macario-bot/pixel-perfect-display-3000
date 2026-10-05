import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Apple, ArrowRight, CalendarDays, Check, Clock, Dumbbell, LineChart, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { fetchCheckins, fetchProfile, setCheckin, toggleTask, type Task } from "@/lib/data";
import { CHECKIN_ITEMS, greeting, OFFLINE_CHECKIN_KEY, PERIOD_LABEL, todayISO, type Period } from "@/lib/viva";
import { TaskRow, useRoutine } from "@/components/task-list";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início — VIVA" },
      { name: "description", content: "Seu foco de hoje, check-in diário e progresso do dia." },
      { property: "og:title", content: "Início — VIVA" },
      { property: "og:description", content: "Seu foco de hoje e o progresso do seu dia." },
    ],
  }),
  component: InicioPage,
});

function InicioPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { tasks, done } = useRoutine();

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: () => fetchProfile(user!.id),
  });

  const checkins = useQuery({
    queryKey: ["checkins", user?.id, todayISO()],
    enabled: !!user,
    queryFn: () => fetchCheckins(user!.id),
  });

  const checkinMap = new Map((checkins.data ?? []).map((row) => [row.item, row.done]));
  const total = (tasks.data ?? []).length + CHECKIN_ITEMS.length;
  const completed =
    (done.data?.size ?? 0) + CHECKIN_ITEMS.filter((item) => checkinMap.get(item.id)).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const focus = (tasks.data ?? []).find((task) => !done.data?.has(task.id)) ?? null;

  const agenda = useMemo(() => {
    const timeKey = (task: Task) => {
      if (task.time_of_day) {
        const [h, m] = task.time_of_day.split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
      }
      // Sem horário: vai para o fim do dia, na ordem manhã → tarde → noite.
      const periodOrder: Record<Period, number> = { manha: 0, tarde: 1, noite: 2 };
      return 24 * 60 + periodOrder[task.period as Period] * 60;
    };
    return (tasks.data ?? [])
      .slice()
      .sort((a, b) => timeKey(a) - timeKey(b) || a.sort_order - b.sort_order);
  }, [tasks.data]);

  async function handleCheckin(item: string, next: boolean) {
    if (!user) return;
    try {
      await setCheckin(user.id, item, next);
      await queryClient.invalidateQueries({ queryKey: ["checkins", user.id, todayISO()] });
      await queryClient.invalidateQueries({ queryKey: ["history", user.id] });
    } catch (error) {
      console.error(error);
      // Offline: guarda localmente para sincronizar depois, sem duplicar.
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(OFFLINE_CHECKIN_KEY);
        const pending: Record<string, boolean> = raw ? JSON.parse(raw) : {};
        pending[`${todayISO()}:${item}`] = next;
        window.localStorage.setItem(OFFLINE_CHECKIN_KEY, JSON.stringify(pending));
      }
      toast.info("Sem conexão agora. Salvamos no seu dispositivo e sincronizamos depois.");
    }
  }

  const firstName = (profile.data?.name ?? "").trim().split(" ")[0] || "tudo bem";

  return (
    <div className="fade-in-soft space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">{todayLabel()}</p>
        <h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
          {greeting()}, {firstName}.
        </h1>
      </header>

      <section className="panel bg-hero-glow p-6 sm:p-7">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-xs tracking-[0.2em] text-primary">SEU FOCO DE HOJE</p>
            <h2 className="mt-3 font-display text-xl font-semibold">
              {tasks.isLoading
                ? "Carregando sua rotina..."
                : focus
                  ? focus.title
                  : "Tudo concluído por hoje."}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {focus
                ? focus.description
                : "Aproveite o resto do dia com calma. Amanhã sua rotina recomeça."}
            </p>
          </div>
          <ProgressRing percent={percent} />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ShortcutCard to="/rotina" label="Rotina" icon={CalendarDays} value={`${(tasks.data ?? []).length} atividades`} />
        <ShortcutCard to="/alimentacao" label="Alimentação" icon={Apple} value="Refeições do dia" />
        <ShortcutCard to="/movimento" label="Movimento" icon={Dumbbell} value="Seu movimento" />
        <ShortcutCard to="/habitos" label="Hábitos" icon={ListChecks} value="Pequenos hábitos" />
        <ShortcutCard to="/progresso" label="Progresso" icon={LineChart} value="Sequência e histórico" />
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Agenda de hoje</h2>
          <span className="text-sm text-muted-foreground">{agenda.length} atividades</span>
        </div>
        {tasks.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando...</p>
        ) : agenda.length === 0 ? (
          <div className="panel mt-4 p-6 text-sm text-muted-foreground">
            Você ainda não tem uma rotina.{" "}
            <Link to="/quiz" className="text-primary hover:underline">
              Responder o quiz
            </Link>
            .
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {agenda.map((task) => (
              <TimelineRow key={task.id} task={task} done={done.data?.has(task.id) ?? false} />
            ))}
          </div>
        )}
      </section>

      <section className="panel p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Check-in de hoje</h2>
          <span className="text-sm text-muted-foreground">{percent}% do dia</span>
        </div>
        <div className="mt-5 space-y-2">
          {CHECKIN_ITEMS.map((item) => {
            const checked = checkinMap.get(item.id) ?? false;
            return (
              <label
                key={item.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                  checked ? "border-primary/40 bg-primary-soft/25" : "border-border bg-surface/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => handleCheckin(item.id, e.target.checked)}
                  className="size-4 accent-primary"
                />
                <span className={checked ? "text-muted-foreground line-through" : ""}>
                  {item.label}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Atividades de hoje</h2>
          <Link to="/rotina" className="inline-flex items-center gap-1 text-sm text-primary">
            Ver rotina <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {(tasks.data ?? []).slice(0, 4).map((task) => (
            <TaskRow key={task.id} task={task} done={done.data?.has(task.id) ?? false} />
          ))}
          {!tasks.isLoading && (tasks.data ?? []).length === 0 ? (
            <div className="panel p-6 text-sm text-muted-foreground">
              Você ainda não tem uma rotina.{" "}
              <Link to="/quiz" className="text-primary hover:underline">
                Responder o quiz
              </Link>
              .
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function todayLabel() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function TimelineRow({ task, done }: { task: Task; done: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  async function handleToggle() {
    if (!user) return;
    try {
      await toggleTask(user.id, task.id, !done);
      await queryClient.invalidateQueries({ queryKey: ["completions", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["history", user.id] });
    } catch (error) {
      console.error(error);
      toast.error("Não conseguimos salvar agora. Tente novamente.");
    }
  }

  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border px-4 py-3 transition-colors ${
        done ? "border-primary/40 bg-primary-soft/25" : "border-border bg-surface/60"
      }`}
    >
      <span className="w-12 shrink-0 font-display text-sm font-semibold text-primary">
        {task.time_of_day ?? "—"}
      </span>
      <button
        onClick={handleToggle}
        aria-label={done ? `Desmarcar ${task.title}` : `Concluir ${task.title}`}
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
          done ? "border-primary bg-primary" : "border-border hover:border-primary"
        }`}
      >
        {done ? <Check className="size-3.5 text-primary-foreground" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>
          {task.title}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{task.duration_min} min</span>
          <span className="rounded-full bg-surface-strong px-2 py-0.5">
            {PERIOD_LABEL[task.period as Period] ?? task.period}
          </span>
        </p>
      </div>
    </div>
  );
}

export function ProgressRing({ percent }: { percent: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, percent) / 100) * circumference;
  return (
    <div className="relative size-24 shrink-0">
      <svg viewBox="0 0 80 80" className="size-full -rotate-90">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--surface-strong)" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-semibold">
        {percent}%
      </span>
    </div>
  );
}

function ShortcutCard({
  to,
  label,
  value,
  icon: Icon,
}: {
  to: "/rotina" | "/alimentacao" | "/movimento" | "/habitos" | "/progresso";
  label: string;
  value: string;
  icon: typeof Apple;
}) {
  return (
    <Link to={to} className="panel p-5 transition-transform hover:-translate-y-0.5">
      <Icon className="size-5 text-primary" />
      <p className="mt-4 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{value}</p>
    </Link>
  );
}
