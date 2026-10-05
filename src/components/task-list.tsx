import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { fetchCompletions, fetchTasks, isTaskToday, toggleTask, type Task } from "@/lib/data";
import { WEEKDAYS } from "@/lib/reminders";
import { PERIOD_LABEL, type Period } from "@/lib/viva";

export function useRoutine({ todayOnly = true }: { todayOnly?: boolean } = {}) {
  const { user } = useAuth();
  const tasks = useQuery({
    queryKey: ["tasks", user?.id],
    enabled: !!user,
    queryFn: () => fetchTasks(user!.id),
    select: todayOnly ? (list: Task[]) => list.filter((t) => isTaskToday(t)) : undefined,
  });
  const done = useQuery({
    queryKey: ["completions", user?.id],
    enabled: !!user,
    queryFn: () => fetchCompletions(user!.id),
  });
  return { tasks, done };
}

export function daysLabel(days?: number[]) {
  if (!days || days.length === 7) return "Todos os dias";
  if (days.length === 0) return "Nenhum dia";
  return [...days].sort().map((d) => WEEKDAYS[d]).join(", ");
}

export function TaskRow({ task, done }: { task: Task; done: boolean }) {
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
      className={`flex items-start gap-4 rounded-2xl border p-4 transition-colors ${
        done ? "border-primary/40 bg-primary-soft/25" : "border-border bg-surface/60"
      }`}
    >
      <button
        onClick={handleToggle}
        aria-label={done ? `Desmarcar ${task.title}` : `Concluir ${task.title}`}
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
          done ? "border-primary bg-primary" : "border-border hover:border-primary"
        }`}
      >
        {done ? <Check className="size-3.5 text-primary-foreground" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>
          {task.title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {task.time_of_day ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3" />
              {task.time_of_day}
            </span>
          ) : null}
          <span>{task.duration_min} min</span>
          <span className="rounded-full bg-surface-strong px-2 py-0.5">
            {PERIOD_LABEL[task.period as Period] ?? task.period}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CategoryPage({
  title,
  description,
  category,
}: {
  title: string;
  description: string;
  category: string;
}) {
  const { tasks, done } = useRoutine();
  const list = (tasks.data ?? []).filter((task) => task.category === category);

  return (
    <div className="fade-in-soft">
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>

      {tasks.isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando...</p>
      ) : tasks.isError ? (
        <p className="mt-8 text-sm text-destructive">Não foi possível carregar suas atividades.</p>
      ) : list.length === 0 ? (
        <div className="panel mt-8 p-6 text-sm text-muted-foreground">
          Nenhuma atividade desta área na sua rotina ainda. Refaça o quiz em Configurações para
          atualizar seu plano.
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {list.map((task) => (
            <TaskRow key={task.id} task={task} done={done.data?.has(task.id) ?? false} />
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        Sugestões de organização de hábitos. Não substituem orientação de profissionais de saúde.
      </p>
    </div>
  );
}
