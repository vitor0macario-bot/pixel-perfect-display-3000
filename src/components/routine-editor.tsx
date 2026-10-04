import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Task } from "@/lib/data";
import { CATEGORY_LABEL, PERIOD_LABEL, type Period } from "@/lib/viva";
import { proposeRoutine, type ProposedTask } from "@/lib/routine-ai.functions";

type Draft = {
  title: string;
  description: string;
  period: string;
  category: string;
  time_of_day: string;
  duration_min: number;
};

const EMPTY: Draft = {
  title: "",
  description: "",
  period: "manha",
  category: "habitos",
  time_of_day: "",
  duration_min: 10,
};

export function TaskForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Draft;
  onSave: (d: Draft) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="panel space-y-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!d.title.trim()) return;
        setSaving(true);
        await onSave(d);
        setSaving(false);
      }}
    >
      <input
        className="input-base"
        placeholder="Nome da atividade"
        value={d.title}
        onChange={(e) => setD({ ...d, title: e.target.value })}
        maxLength={120}
      />
      <input
        className="input-base"
        placeholder="Descrição (opcional)"
        value={d.description}
        onChange={(e) => setD({ ...d, description: e.target.value })}
        maxLength={300}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <select className="input-base" value={d.period} onChange={(e) => setD({ ...d, period: e.target.value })}>
          {Object.entries(PERIOD_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className="input-base" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })}>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input
          type="time"
          className="input-base"
          value={d.time_of_day}
          onChange={(e) => setD({ ...d, time_of_day: e.target.value })}
        />
        <input
          type="number"
          min={1}
          max={240}
          className="input-base"
          value={d.duration_min}
          onChange={(e) => setD({ ...d, duration_min: Number(e.target.value) || 10 })}
          aria-label="Duração em minutos"
        />
      </div>
      <div className="flex gap-2">
        <button
          disabled={saving || !d.title.trim()}
          className="rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-border px-5 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function useTaskMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks", user?.id] });

  async function create(d: Draft) {
    if (!user) return;
    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      title: d.title.trim(),
      description: d.description.trim(),
      period: d.period,
      category: d.category,
      time_of_day: d.time_of_day || null,
      duration_min: d.duration_min,
      sort_order: Date.now() % 1_000_000,
    });
    if (error) return void toast.error("Não foi possível adicionar.");
    toast.success("Atividade adicionada");
    await refresh();
  }

  async function update(id: string, d: Draft) {
    const { error } = await supabase
      .from("tasks")
      .update({
        title: d.title.trim(),
        description: d.description.trim(),
        period: d.period,
        category: d.category,
        time_of_day: d.time_of_day || null,
        duration_min: d.duration_min,
      })
      .eq("id", id);
    if (error) return void toast.error("Não foi possível salvar.");
    toast.success("Atividade atualizada");
    await refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Remover esta atividade da sua rotina?")) return;
    const { error } = await supabase.from("tasks").update({ active: false }).eq("id", id);
    if (error) return void toast.error("Não foi possível remover.");
    await refresh();
  }

  async function replaceAll(list: ProposedTask[]) {
    if (!user) return;
    const { error: e1 } = await supabase.from("tasks").update({ active: false }).eq("user_id", user.id);
    if (e1) return void toast.error("Não foi possível aplicar.");
    const { error } = await supabase.from("tasks").insert(
      list.map((t, i) => ({
        user_id: user.id,
        period: t.period,
        category: t.category,
        title: t.title,
        description: t.description ?? "",
        time_of_day: t.time_of_day ?? null,
        duration_min: t.duration_min,
        sort_order: i,
      })),
    );
    if (error) return void toast.error("Não foi possível aplicar.");
    toast.success("Nova rotina aplicada");
    await refresh();
  }

  return { create, update, remove, replaceAll };
}

export function TaskActions({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false);
  const { update, remove } = useTaskMutations();
  if (editing) {
    return (
      <div className="mt-2">
        <TaskForm
          initial={{
            title: task.title,
            description: task.description,
            period: task.period,
            category: task.category,
            time_of_day: task.time_of_day ?? "",
            duration_min: task.duration_min,
          }}
          onCancel={() => setEditing(false)}
          onSave={async (d) => {
            await update(task.id, d);
            setEditing(false);
          }}
        />
      </div>
    );
  }
  return (
    <div className="flex justify-end gap-1">
      <button onClick={() => setEditing(true)} aria-label={`Editar ${task.title}`} className="rounded-full p-2 text-muted-foreground hover:text-foreground">
        <Pencil className="size-3.5" />
      </button>
      <button onClick={() => remove(task.id)} aria-label={`Remover ${task.title}`} className="rounded-full p-2 text-muted-foreground hover:text-destructive">
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

export function AiRoutinePanel() {
  const run = useServerFn(proposeRoutine);
  const { replaceAll } = useTaskMutations();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [proposal, setProposal] = useState<{ resumo: string; tarefas: ProposedTask[] } | null>(null);

  async function ask() {
    setLoading(true);
    setProposal(null);
    try {
      const r = await run({ data: { request } });
      if ("error" in r && r.error) toast.error(r.error);
      else if ("tarefas" in r && r.tarefas) setProposal({ resumo: r.resumo ?? "", tarefas: r.tarefas });
    } catch {
      toast.error("Não conseguimos sugerir uma rotina agora.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-4 py-2 text-sm text-primary hover:bg-primary-soft/25"
      >
        <Sparkles className="size-4" /> Pedir para a IA ajustar
      </button>
    );
  }

  return (
    <section className="panel mt-6 space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Sparkles className="size-4 text-primary" /> Ajustar com a VIVA AI
        </h2>
        <button onClick={() => setOpen(false)} aria-label="Fechar" className="text-muted-foreground">
          <X className="size-4" />
        </button>
      </div>
      <textarea
        className="input-base resize-y"
        rows={2}
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        placeholder="Opcional: ex. quero acordar mais cedo e caminhar à tarde"
        maxLength={1500}
      />
      <button
        onClick={ask}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        {loading ? "Pensando..." : "Sugerir nova rotina"}
      </button>

      {proposal ? (
        <div className="space-y-3 border-t border-border pt-4">
          {proposal.resumo ? <p className="text-sm">{proposal.resumo}</p> : null}
          <ul className="space-y-2">
            {proposal.tarefas.map((t, i) => (
              <li key={i} className="rounded-xl bg-surface/60 p-3 text-sm">
                <span className="font-medium">{t.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {PERIOD_LABEL[t.period as Period]} · {t.time_of_day ?? "sem horário"} · {t.duration_min} min
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={applying}
              onClick={async () => {
                setApplying(true);
                await replaceAll(proposal.tarefas);
                setApplying(false);
                setProposal(null);
                setOpen(false);
              }}
              className="rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {applying ? "Aplicando..." : "Aplicar à minha rotina"}
            </button>
            <button onClick={() => setProposal(null)} className="rounded-full border border-border px-5 py-2 text-sm">
              Descartar
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Sugestões de organização de hábitos. Não substituem orientação profissional.
          </p>
        </div>
      ) : null}
    </section>
  );
}

export function AddTaskButton() {
  const [open, setOpen] = useState(false);
  const { create } = useTaskMutations();
  if (open)
    return (
      <div className="mt-6">
        <TaskForm
          onCancel={() => setOpen(false)}
          onSave={async (d) => {
            await create(d);
            setOpen(false);
          }}
        />
      </div>
    );
  return (
    <button
      onClick={() => setOpen(true)}
      className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
    >
      <Plus className="size-4" /> Adicionar atividade
    </button>
  );
}
