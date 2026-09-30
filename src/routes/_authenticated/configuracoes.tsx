import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchProfile } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — VIVA" },
      {
        name: "description",
        content: "Ajuste seu nome, horários, notificações e plano da sua conta VIVA.",
      },
      { property: "og:title", content: "Configurações — VIVA" },
      { property: "og:description", content: "Nome, horários, notificações e plano." },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [wake, setWake] = useState("");
  const [sleep, setSleep] = useState("");
  const [notifications, setNotifications] = useState(true);
  const [saving, setSaving] = useState(false);

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: () => fetchProfile(user!.id),
  });

  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.name ?? "");
    setWake(profile.data.wake_time ?? "");
    setSleep(profile.data.sleep_time ?? "");
    setNotifications(profile.data.notifications ?? true);
  }, [profile.data]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name,
          wake_time: wake || null,
          sleep_time: sleep || null,
          notifications,
        })
        .eq("user_id", user.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Preferências salvas.");
    } catch (error) {
      console.error(error);
      toast.error("Não conseguimos salvar agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fade-in-soft space-y-8">
      <header>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Configurações</h1>
        <p className="mt-3 text-sm text-muted-foreground">{user?.email}</p>
      </header>

      <section className="panel space-y-5 p-6">
        <h2 className="font-display text-lg font-semibold">Seus dados</h2>
        <label className="block">
          <span className="text-xs tracking-wide text-muted-foreground uppercase">Nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-base mt-2" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs tracking-wide text-muted-foreground uppercase">
              Horário que acorda
            </span>
            <input
              type="time"
              value={wake}
              onChange={(e) => setWake(e.target.value)}
              className="input-base mt-2"
            />
          </label>
          <label className="block">
            <span className="text-xs tracking-wide text-muted-foreground uppercase">
              Horário que dorme
            </span>
            <input
              type="time"
              value={sleep}
              onChange={(e) => setSleep(e.target.value)}
              className="input-base mt-2"
            />
          </label>
        </div>
        <label className="flex items-center justify-between rounded-xl border border-border bg-surface/50 px-4 py-3">
          <span className="text-sm">Notificações e lembretes</span>
          <input
            type="checkbox"
            checked={notifications}
            onChange={(e) => setNotifications(e.target.checked)}
            className="size-4 accent-primary"
          />
        </label>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Salvar
        </button>
      </section>

      <section className="panel p-6">
        <h2 className="font-display text-lg font-semibold">Seu plano</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Plano atual:{" "}
          <span className="text-foreground uppercase">{profile.data?.plan ?? "free"}</span>
        </p>
        <Link
          to="/planos"
          className="mt-5 inline-flex rounded-full border border-border bg-surface px-6 py-3 text-sm font-medium transition-colors hover:bg-surface-strong"
        >
          Ver planos
        </Link>
      </section>

      <section className="panel p-6">
        <h2 className="font-display text-lg font-semibold">Sua rotina</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Mudou algo na sua vida? Refaça o quiz para gerar uma nova rotina.
        </p>
        <Link
          to="/quiz"
          className="mt-5 inline-flex rounded-full border border-border bg-surface px-6 py-3 text-sm font-medium transition-colors hover:bg-surface-strong"
        >
          Refazer o quiz
        </Link>
      </section>

      <button
        onClick={async () => {
          await signOut();
          queryClient.clear();
          navigate({ to: "/" });
        }}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <LogOut className="size-4" />
        Sair da conta
      </button>
    </div>
  );
}
