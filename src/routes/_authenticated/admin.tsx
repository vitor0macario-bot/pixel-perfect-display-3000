import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — VIVA" },
      { name: "description", content: "Área administrativa com usuários, assinaturas e métricas." },
      { property: "og:title", content: "Admin — VIVA" },
      { property: "og:description", content: "Usuários, assinaturas e métricas do VIVA." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();

  const isAdmin = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" });
      return Boolean(data);
    },
  });

  const metrics = useQuery({
    queryKey: ["admin-metrics"],
    enabled: isAdmin.data === true,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const sinceISO = since.toISOString();

      const [profiles, subs, checkins] = await Promise.all([
        supabase.from("profiles").select("user_id, name, plan, quiz_completed, plan_created, last_active_at, created_at"),
        supabase.from("subscriptions").select("user_id, plan, status"),
        supabase.from("checkins").select("id, done, created_at"),
      ]);

      const list = profiles.data ?? [];
      return {
        users: list,
        total: list.length,
        quiz: list.filter((p) => p.quiz_completed).length,
        plans: list.filter((p) => p.plan_created).length,
        active: list.filter((p) => p.last_active_at > sinceISO).length,
        checkins: (checkins.data ?? []).filter((c) => c.done).length,
        pro: (subs.data ?? []).filter((s) => s.plan === "pro").length,
        interested: (subs.data ?? []).filter((s) => s.status === "interested_pro").length,
        canceled: (subs.data ?? []).filter((s) => s.status === "canceled").length,
      };
    },
  });

  if (isAdmin.isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  if (!isAdmin.data) {
    return (
      <div className="panel p-6">
        <h1 className="font-display text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Esta área é apenas para administradores.
        </p>
      </div>
    );
  }

  const m = metrics.data;

  return (
    <div className="fade-in-soft space-y-8">
      <header>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Administração</h1>
        <p className="mt-3 text-sm text-muted-foreground">Usuários, assinaturas e métricas do MVP.</p>
      </header>

      <FreeLimitSetting />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Usuários cadastrados" value={m?.total} />
        <Metric label="Completaram o quiz" value={m?.quiz} />
        <Metric label="Criaram o primeiro plano" value={m?.plans} />
        <Metric label="Ativos (7 dias)" value={m?.active} />
        <Metric label="Check-ins concluídos" value={m?.checkins} />
        <Metric label="Assinantes Pro" value={m?.pro} />
        <Metric label="Interesse no Pro" value={m?.interested} />
        <Metric label="Cancelamentos" value={m?.canceled} />
      </section>

      <section className="panel p-6">
        <h2 className="font-display text-lg font-semibold">Usuários</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="pb-3">Nome</th>
                <th className="pb-3">Plano</th>
                <th className="pb-3">Quiz</th>
                <th className="pb-3">Último acesso</th>
              </tr>
            </thead>
            <tbody>
              {(m?.users ?? []).map((row) => (
                <tr key={row.user_id} className="border-t border-border">
                  <td className="py-3">{row.name || "—"}</td>
                  <td className="py-3 uppercase">{row.plan}</td>
                  <td className="py-3">{row.quiz_completed ? "Sim" : "Não"}</td>
                  <td className="py-3 text-muted-foreground">
                    {new Date(row.last_active_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="panel p-5">
      <p className="font-display text-2xl font-semibold">{value ?? "—"}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function FreeLimitSetting() {
  const [value, setValue] = useState("5");
  const [saving, setSaving] = useState(false);
  const setting = useQuery({
    queryKey: ["app-setting", "free_daily_ai_limit"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "free_daily_ai_limit").maybeSingle();
      return Number(data?.value ?? 5);
    },
  });
  useEffect(() => {
    if (setting.data !== undefined) setValue(String(setting.data));
  }, [setting.data]);

  async function save() {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 0 || n > 1000) {
      toast.error("Informe um número entre 0 e 1000.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "free_daily_ai_limit", value: n, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) toast.error("Não foi possível salvar.");
    else {
      toast.success("Limite atualizado.");
      setting.refetch();
    }
  }

  return (
    <section className="panel p-6">
      <h2 className="font-display text-lg font-semibold">VIVA AI no plano Free</h2>
      <p className="mt-2 text-sm text-muted-foreground">Perguntas por dia permitidas para quem está no Free. O Pro é sempre ilimitado.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="number"
          min={0}
          max={1000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input-base w-28"
          aria-label="Perguntas diárias no Free"
        />
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </section>
  );
}
