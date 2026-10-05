import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROMPT = `Você é a VIVA, ferramenta de organização de hábitos (pt-BR, tom acolhedor).
Receba a rotina atual da pessoa, check-ins recentes e um pedido. Devolva a ROTINA COMPLETA melhorada.
Responda SOMENTE com JSON válido, sem markdown, no formato:
{"resumo":"2-3 frases explicando o que mudou","tarefas":[{"period":"manha|tarde|noite","category":"rotina|habitos|alimentacao|movimento","title":"...","description":"uma frase","time_of_day":"HH:MM ou null","duration_min":10}]}
Entre 4 e 14 tarefas, pequenas e realistas. Nunca diagnosticar, prescrever, prometer perda de peso, cura ou resultados garantidos.`;

const TaskSchema = z.object({
  period: z.enum(["manha", "tarde", "noite"]),
  category: z.enum(["rotina", "habitos", "alimentacao", "movimento"]),
  title: z.string().min(1).max(120),
  description: z.string().max(300).default(""),
  time_of_day: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  duration_min: z.coerce.number().int().min(1).max(240).default(10),
});

export type ProposedTask = z.infer<typeof TaskSchema>;

export const proposeRoutine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ request: z.string().max(1500) }).parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "Recurso temporariamente indisponível." };

    const from = new Date();
    from.setDate(from.getDate() - 6);
    const [{ data: tasks }, { data: checkins }] = await Promise.all([
      context.supabase
        .from("tasks")
        .select("period, category, title, description, time_of_day, duration_min")
        .eq("user_id", context.userId)
        .eq("active", true)
        .order("sort_order"),
      context.supabase
        .from("checkins")
        .select("day, item, done")
        .eq("user_id", context.userId)
        .gte("day", from.toISOString().slice(0, 10)),
    ]);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        instructions: PROMPT,
        input: `Pedido da pessoa: ${data.request || "melhore minha rotina de forma equilibrada"}\n\nRotina atual: ${JSON.stringify(tasks ?? [])}\n\nCheck-ins dos últimos 7 dias: ${JSON.stringify(checkins ?? [])}`,
      }),
    });

    if (!res.ok) {
      console.error("AI gateway error", res.status, await res.text().catch(() => ""));
      if (res.status === 429) return { error: "Muitas solicitações. Tente novamente em instantes." };
      if (res.status === 402) return { error: "Créditos de IA esgotados no momento." };
      return { error: "Não conseguimos sugerir uma rotina agora." };
    }

    if (!res.body) return { error: "Não conseguimos sugerir uma rotina agora." };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const evt = JSON.parse(raw) as { type?: string; delta?: string };
          if (evt.type === "response.output_text.delta" && evt.delta) text += evt.delta;
        } catch {
          /* parcial */
        }
      }
    }
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { error: "Não conseguimos sugerir uma rotina agora." };
    try {
      const parsed = z
        .object({ resumo: z.string().default(""), tarefas: z.array(z.unknown()) })
        .parse(JSON.parse(match[0]));
      const tarefas = parsed.tarefas
        .map((t) => TaskSchema.safeParse(t))
        .filter((r) => r.success)
        .map((r) => r.data as ProposedTask);
      if (!tarefas.length) return { error: "Não conseguimos sugerir uma rotina agora." };
      return { resumo: parsed.resumo, tarefas };
    } catch {
      return { error: "Não conseguimos sugerir uma rotina agora." };
    }
  });
