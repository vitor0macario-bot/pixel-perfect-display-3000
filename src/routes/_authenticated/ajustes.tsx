import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { recommendAdjustments } from "@/lib/adjust.functions";

export const Route = createFileRoute("/_authenticated/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes personalizados — VIVA" },
      { name: "description", content: "Receba sugestões de ajustes na rotina com base nos seus check-ins e objetivos." },
      { property: "og:title", content: "Ajustes personalizados — VIVA" },
      { property: "og:description", content: "Sugestões pequenas e práticas para sua rotina." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AjustesPage,
});

function AjustesPage() {
  const { user } = useAuth();
  const run = useServerFn(recommendAdjustments);
  const [checkins, setCheckins] = useState("");
  const [goals, setGoals] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const from = new Date();
    from.setDate(from.getDate() - 6);
    supabase
      .from("checkins")
      .select("day, item, done")
      .eq("user_id", user.id)
      .gte("day", from.toISOString().slice(0, 10))
      .order("day")
      .then(({ data }) => {
        if (!data?.length) return;
        const byDay = new Map<string, string[]>();
        for (const r of data) {
          const list = byDay.get(r.day) ?? [];
          list.push(`${r.item}: ${r.done ? "sim" : "não"}`);
          byDay.set(r.day, list);
        }
        setCheckins((prev) => prev || [...byDay].map(([d, l]) => `${d} — ${l.join(", ")}`).join("\n"));
      });
  }, [user]);

  async function submit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await run({ data: { checkins, goals } });
      if ("error" in r && r.error) setError(r.error);
      else if ("text" in r) setResult(r.text ?? null);
    } catch {
      setError("Não conseguimos gerar sugestões agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-in-soft space-y-8">
      <header>
        <div className="flex items-center gap-2">
          <Wand2 className="size-5 text-primary" />
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Ajustes personalizados</h1>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Conte como foram seus últimos dias e o que você busca agora. A VIVA sugere pequenos ajustes.
        </p>
      </header>

      <section className="panel space-y-5 p-6">
        <label className="block">
          <span className="text-xs tracking-wide text-muted-foreground uppercase">Check-ins recentes</span>
          <textarea
            value={checkins}
            onChange={(e) => setCheckins(e.target.value)}
            rows={5}
            placeholder="Ex.: dormi mal na terça, bebi pouca água, caminhei 2 vezes"
            className="input-base mt-2 resize-y"
          />
        </label>
        <label className="block">
          <span className="text-xs tracking-wide text-muted-foreground uppercase">Objetivos atuais</span>
          <textarea
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            rows={3}
            placeholder="Ex.: ter mais energia de manhã e manter constância nas caminhadas"
            className="input-base mt-2 resize-y"
          />
        </label>
        <button
          onClick={submit}
          disabled={loading || !goals.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          Gerar sugestões
        </button>
      </section>

      {error ? <p className="panel p-6 text-sm text-destructive">{error}</p> : null}
      {result ? (
        <section className="panel p-6">
          <h2 className="font-display text-lg font-semibold">Sugestões para você</h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{result}</p>
          <p className="mt-6 text-xs text-muted-foreground">
            Sugestões de organização de hábitos. Não substituem orientação profissional.
          </p>
        </section>
      ) : null}
    </div>
  );
}
