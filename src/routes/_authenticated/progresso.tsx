import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Flame, CalendarCheck, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { computeStreak, fetchHistory } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/progresso")({
  head: () => ({
    meta: [
      { title: "Progresso — VIVA" },
      {
        name: "description",
        content: "Sequência atual, dias concluídos, metas semanais e histórico de consistência.",
      },
      { property: "og:title", content: "Progresso — VIVA" },
      { property: "og:description", content: "Acompanhe sua consistência ao longo das semanas." },
    ],
  }),
  component: ProgressoPage,
});

function ProgressoPage() {
  const { user } = useAuth();

  const history = useQuery({
    queryKey: ["history", user?.id],
    enabled: !!user,
    queryFn: () => fetchHistory(user!.id, 30),
  });

  const goals = useQuery({
    queryKey: ["goals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("goals")
        .select("id, title, target")
        .eq("user_id", user!.id)
        .order("created_at");
      return data ?? [];
    },
  });

  const data = history.data ?? [];
  const streak = computeStreak(data);
  const activeDays = data.filter((d) => d.count > 0).length;
  const last7 = data.slice(-7);
  const weekDays = last7.filter((d) => d.count > 0).length;

  const chartData = data.map((d) => ({
    day: new Date(`${d.day}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    count: d.count,
  }));

  return (
    <div className="fade-in-soft space-y-8">
      <header>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Progresso</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sua consistência, sem cobrança e sem medidas corporais.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Flame} label="Sequência atual" value={`${streak} ${streak === 1 ? "dia" : "dias"}`} />
        <StatCard icon={CalendarCheck} label="Dias concluídos (30d)" value={`${activeDays}`} />
        <StatCard icon={Target} label="Dias ativos na semana" value={`${weekDays}/7`} />
      </section>

      <section className="panel p-6">
        <h2 className="font-display text-lg font-semibold">Metas semanais</h2>
        <div className="mt-5 space-y-4">
          {(goals.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Suas metas aparecem aqui depois de criar seu plano.
            </p>
          ) : null}
          {(goals.data ?? []).map((goal) => {
            const percent = Math.min(100, Math.round((weekDays / goal.target) * 100));
            return (
              <div key={goal.id}>
                <div className="flex items-center justify-between text-sm">
                  <span>{goal.title}</span>
                  <span className="text-muted-foreground">
                    {weekDays}/{goal.target}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-strong">
                  <div
                    className="h-full rounded-full bg-gradient-primary transition-all duration-700"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="font-display text-lg font-semibold">Consistência (últimos 30 dias)</h2>
        <div className="mt-6 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="vivaArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                interval={5}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  color: "var(--foreground)",
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--muted-foreground)" }}
                formatter={(value) => [`${value} conclusões`, ""]}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#vivaArea)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="font-display text-lg font-semibold">Histórico</h2>
        <div className="mt-5 grid grid-cols-7 gap-2">
          {data.slice(-28).map((d) => (
            <div
              key={d.day}
              title={`${new Date(`${d.day}T12:00:00`).toLocaleDateString("pt-BR")} — ${d.count} conclusões`}
              className="aspect-square rounded-lg border border-border"
              style={{
                background:
                  d.count === 0
                    ? "var(--surface)"
                    : `color-mix(in oklab, var(--primary) ${Math.min(90, 25 + d.count * 15)}%, var(--surface))`,
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
}) {
  return (
    <div className="panel p-5">
      <Icon className="size-5 text-primary" />
      <p className="mt-4 font-display text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
