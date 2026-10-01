import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROMPT = `Você é a VIVA, ferramenta de organização de hábitos. Fale português do Brasil, tom acolhedor e sem julgamento.
Com base nos check-ins recentes, objetivos e rotina da pessoa, sugira de 3 a 5 ajustes práticos e pequenos na rotina de bem-estar.
Formato: lista curta, cada item com o ajuste e o porquê em uma frase.
Regras: nunca diagnosticar, prescrever, prometer perda de peso, cura ou resultados garantidos. Se algo parecer clínico, sugira procurar um profissional.`;

export const recommendAdjustments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ checkins: z.string().max(3000), goals: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "Recurso temporariamente indisponível." };

    const { data: tasks } = await context.supabase
      .from("tasks")
      .select("period, category, title, duration_min")
      .eq("user_id", context.userId)
      .eq("active", true);

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
        input: `Check-ins recentes:\n${data.checkins || "(não informado)"}\n\nObjetivos atuais:\n${data.goals}\n\nRotina atual: ${JSON.stringify(tasks ?? [])}`,
      }),
    });

    if (!res.ok || !res.body) {
      console.error("AI gateway error", res.status, await res.text().catch(() => ""));
      if (res.status === 429) return { error: "Muitas solicitações. Tente novamente em instantes." };
      if (res.status === 402) return { error: "Créditos de IA esgotados no momento." };
      return { error: "Não conseguimos gerar sugestões agora." };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let failed = false;
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
          if (evt.type === "response.failed" || evt.type === "error") failed = true;
        } catch {
          /* linha parcial */
        }
      }
    }
    if (failed || !text.trim()) return { error: "Não conseguimos gerar sugestões agora." };
    return { text: text.trim() };
  });
