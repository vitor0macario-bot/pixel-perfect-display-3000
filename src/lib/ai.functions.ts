import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const FREE_DAILY_LIMIT = 5;

const SYSTEM_PROMPT = `Você é a VIVA AI, assistente de organização de hábitos e bem-estar do app VIVA.
Fale português do Brasil, em tom acolhedor, direto e sem julgamento.
Você responde perguntas gerais sobre hábitos, sono, hidratação, alimentação equilibrada, movimento, foco, produtividade, organização da rotina e motivação, com informações educativas e práticas.
Use o contexto do usuário (quiz, rotina, check-ins) para personalizar as respostas quando fizer sentido.
Regras obrigatórias:
- Nunca faça diagnóstico, nunca prescreva medicamentos, suplementos, dietas restritivas ou tratamentos.
- Nunca prometa perda de peso, cura ou resultados garantidos.
- Não substitua médico, nutricionista ou outro profissional de saúde; se o assunto for clínico ou de risco, recomende procurar um profissional.
- Se a pergunta estiver fora de bem-estar e rotina, responda brevemente e traga a conversa de volta aos hábitos.
- Seja objetivo: até 6 frases ou uma lista curta. Não use markdown com asteriscos.`;

async function countToday(supabase: any, userId: string) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("ai_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

export const getVivaUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles").select("plan").eq("user_id", context.userId).maybeSingle();
    const pro = profile?.plan === "pro";
    const used = await countToday(context.supabase, context.userId);
    return { pro, used, limit: pro ? null : FREE_DAILY_LIMIT };
  });

export const chatWithViva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ message: z.string().min(1).max(2000) }).parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { reply: "A VIVA AI está temporariamente indisponível. Tente novamente em instantes.", error: true };
    }

    const supabase = context.supabase;
    const userId = context.userId;
    const today = new Date().toISOString().slice(0, 10);

    const [profile, quiz, tasks, completions, checkins, history, used] = await Promise.all([
      supabase.from("profiles").select("name, plan, wake_time, sleep_time").eq("user_id", userId).maybeSingle(),
      supabase.from("quiz_responses").select("answers").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
      supabase.from("tasks").select("period, category, title, duration_min, time_of_day").eq("user_id", userId).eq("active", true).order("sort_order"),
      supabase.from("task_completions").select("task_id").eq("user_id", userId).eq("day", today),
      supabase.from("checkins").select("item, done").eq("user_id", userId).eq("day", today),
      supabase.from("ai_messages").select("role, content").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      countToday(supabase, userId),
    ]);

    const pro = profile.data?.plan === "pro";
    if (!pro && used >= FREE_DAILY_LIMIT) {
      return {
        reply: `Você usou suas ${FREE_DAILY_LIMIT} perguntas gratuitas de hoje. Amanhã elas renovam — ou assine o Pro para conversar sem limite.`,
        limited: true,
        used,
      };
    }

    const contextBlock = [
      `Nome: ${profile.data?.name ?? "usuário"}`,
      `Horários: acorda ${profile.data?.wake_time ?? "?"}, dorme ${profile.data?.sleep_time ?? "?"}`,
      `Respostas do quiz: ${JSON.stringify(quiz.data?.[0]?.answers ?? {})}`,
      `Rotina atual: ${JSON.stringify(tasks.data ?? [])}`,
      `Tarefas concluídas hoje: ${(completions.data ?? []).length}`,
      `Check-ins de hoje: ${JSON.stringify(checkins.data ?? [])}`,
    ].join("\n");

    const recent = (history.data ?? []).reverse().map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        instructions: `${SYSTEM_PROMPT}\n\nContexto do usuário:\n${contextBlock}`,
        input: [...recent, { role: "user", content: data.message }],
      }),
    });

    if (!res.ok || !res.body) {
      console.error("AI gateway error", res.status, await res.text().catch(() => ""));
      if (res.status === 429) return { reply: "Muitas mensagens em pouco tempo. Tente novamente em alguns instantes.", error: true };
      if (res.status === 402) return { reply: "A VIVA AI está sem créditos no momento. Tente mais tarde.", error: true };
      return { reply: "Não consegui responder agora. Tente novamente em instantes.", error: true };
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
    const reply = text.replace(/\*\*/g, "").trim();
    if (failed || !reply) return { reply: "Não consegui responder agora. Tente novamente em instantes.", error: true };

    await supabase.from("ai_messages").insert([
      { user_id: userId, role: "user", content: data.message },
      { user_id: userId, role: "assistant", content: reply },
    ]);

    return { reply, used: used + 1 };
  });
