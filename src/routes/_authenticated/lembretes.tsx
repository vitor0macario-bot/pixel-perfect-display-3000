import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useReminders, WEEKDAYS } from "@/lib/reminders";

export const Route = createFileRoute("/_authenticated/lembretes")({
  head: () => ({
    meta: [
      { title: "Lembretes — VIVA" },
      { name: "description", content: "Crie lembretes personalizados para seus hábitos e tarefas." },
      { property: "og:title", content: "Lembretes — VIVA" },
      { property: "og:description", content: "Lembretes no seu horário, nos dias que você escolher." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LembretesPage,
});

function LembretesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const reminders = useReminders(user?.id);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("08:00");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["reminders", user?.id] });

  async function add() {
    if (!user || !title.trim() || days.length === 0) return;
    const { error } = await supabase
      .from("reminders")
      .insert({ user_id: user.id, title: title.trim(), remind_at: time, days });
    if (error) return toast.error("Não conseguimos salvar o lembrete.");
    setTitle("");
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    toast.success("Lembrete criado.");
    refresh();
  }

  async function toggle(id: string, enabled: boolean) {
    await supabase.from("reminders").update({ enabled }).eq("id", id);
    refresh();
  }

  async function remove(id: string) {
    await supabase.from("reminders").delete().eq("id", id);
    refresh();
  }

  return (
    <div className="fade-in-soft space-y-8">
      <header>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Lembretes</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Escolha o horário e os dias. Os avisos aparecem enquanto o VIVA estiver aberto.
        </p>
      </header>

      <section className="panel space-y-5 p-6">
        <label className="block">
          <span className="text-xs tracking-wide text-muted-foreground uppercase">O que lembrar</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Beber um copo de água"
            className="input-base mt-2"
          />
        </label>
        <label className="block">
          <span className="text-xs tracking-wide text-muted-foreground uppercase">Horário</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input-base mt-2" />
        </label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d, i) => {
            const on = days.includes(i);
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDays(on ? days.filter((x) => x !== i) : [...days, i].sort())}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
        <button
          onClick={add}
          disabled={!title.trim() || days.length === 0}
          className="rounded-full bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          Adicionar lembrete
        </button>
      </section>

      <section className="space-y-3">
        {(reminders.data ?? []).length === 0 ? (
          <p className="panel p-6 text-sm text-muted-foreground">Você ainda não tem lembretes.</p>
        ) : (
          reminders.data!.map((r) => (
            <div key={r.id} className="panel flex items-center gap-4 p-4">
              <Bell className={`size-5 ${r.enabled ? "text-primary" : "text-muted-foreground"}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {r.remind_at.slice(0, 5)} · {r.days.length === 7 ? "Todos os dias" : r.days.map((d) => WEEKDAYS[d]).join(", ")}
                </p>
              </div>
              <input
                type="checkbox"
                checked={r.enabled}
                onChange={(e) => toggle(r.id, e.target.checked)}
                className="size-4 accent-primary"
                aria-label="Ativar lembrete"
              />
              <button onClick={() => remove(r.id)} aria-label="Excluir lembrete" className="text-muted-foreground hover:text-foreground">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
