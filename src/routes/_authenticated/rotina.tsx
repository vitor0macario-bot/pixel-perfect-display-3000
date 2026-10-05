import { createFileRoute, Link } from "@tanstack/react-router";
import { TaskRow, useRoutine } from "@/components/task-list";
import { PERIOD_LABEL, type Period } from "@/lib/viva";
import { AddTaskButton, AiRoutinePanel, TaskActions } from "@/components/routine-editor";

export const Route = createFileRoute("/_authenticated/rotina")({
  head: () => ({
    meta: [
      { title: "Minha rotina — VIVA" },
      {
        name: "description",
        content: "Sua rotina de manhã, tarde e noite com atividades, horários e duração.",
      },
      { property: "og:title", content: "Minha rotina — VIVA" },
      { property: "og:description", content: "Manhã, tarde e noite organizados do seu jeito." },
    ],
  }),
  component: RotinaPage,
});

const PERIODS: Period[] = ["manha", "tarde", "noite"];

function RotinaPage() {
  const { tasks, done } = useRoutine({ todayOnly: false });

  return (
    <div className="fade-in-soft">
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">Minha rotina</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Personalize do seu jeito: adicione, edite ou remova atividades — ou peça para a IA ajustar.
      </p>

      <div className="mt-6 flex flex-wrap items-start gap-3">
        <AddTaskButton />
        <AiRoutinePanel />
      </div>

      {tasks.isLoading ? <p className="mt-8 text-sm text-muted-foreground">Carregando...</p> : null}

      {!tasks.isLoading && (tasks.data ?? []).length === 0 ? (
        <div className="panel mt-8 p-6 text-sm text-muted-foreground">
          Você ainda não tem uma rotina criada.{" "}
          <Link to="/quiz" className="text-primary hover:underline">
            Responder o quiz
          </Link>
          .
        </div>
      ) : null}

      <div className="mt-8 space-y-10">
        {PERIODS.map((period) => {
          const list = (tasks.data ?? []).filter((task) => task.period === period);
          if (list.length === 0) return null;
          return (
            <section key={period}>
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-lg font-semibold">{PERIOD_LABEL[period]}</h2>
                <span className="text-xs text-muted-foreground">
                  {list.filter((t) => done.data?.has(t.id)).length}/{list.length} concluídas
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {list.map((task) => (
                  <div key={task.id}>
                    <TaskRow task={task} done={done.data?.has(task.id) ?? false} />
                    <TaskActions task={task} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
