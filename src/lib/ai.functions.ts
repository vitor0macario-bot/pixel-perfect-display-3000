import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `Você é a VIVA AI, assistente de organização de hábitos e bem-estar do app VIVA.
Fale português do Brasil, em tom acolhedor, direto e sem julgamento.
Regras obrigatórias:
- Nunca faça diagnóstico, nunca prescreva medicamentos, suplementos ou tratamentos.
- Nunca prometa perda de peso, cura ou resultados garantidos.
- Não substitua médico, nutricionista ou outro profissional de saúde; se o assunto for clínico, sugira procurar um profissional.
- Ajude a reorganizar a rotina, sugerir alternativas simples e metas pequenas, usando o contexto do usuário.
- Respostas curtas (até 5 frases ou uma lista breve).`;

export const chatWithViva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ message: z.string().min(1).max(2000) }).parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { reply: "A VIVA AI está temporariamente indisponível. Tente novamente em instantes." };
    }

    const supabase = context.supabase;
    const userId = context.userId;
    const today = new Date().toISOString().slice(0, 10);

    const [profile, quiz, tasks, completions, checkins, history] = await Promise.all([
      supabase.from("profiles").select("name, plan, wake_time, sleep_time").eq("user_id", userId).maybeSingle(),
      supabase.from("quiz_responses").select("answers").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
      supabase.from("tasks").select("period, category, title, duration_min, time_of_day").eq("user_id", userId).eq("active", true).order("sort_order"),
      supabase.from("task_completions").select("task_id").eq("user_id", userId).eq("day", today),
      supabase.from("checkins").select("item, done").eq("user_id", userId).eq("day", today),
      supabase.from("ai_messages").select("role, content").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    ]);

    const plan = profile.data?.plan ?? "free";
    if (plan !== "pro") {
      return {
        reply:
          "A VIVA AI faz parte do plano Pro. Você pode continuar usando o quiz, a rotina, os check-ins e o progresso no plano Free.",
        locked: true,
      };
    }

    const contextBlock = [
      `Nome: ${profile.data?.name ?? "usuário"}`,
      `Respostas do quiz: ${JSON.stringify(quiz.data?.[0]?.answers ?? {})}`,
      `Rotina atual: ${JSON.stringify(tasks.data ?? [])}`,
      `Tarefas concluídas hoje: ${(completions.data ?? []).length}`,
      `Check-ins de hoje: ${JSON.stringify(checkins.data ?? [])}`,
    ].join("\n");

    const recent = (history.data ?? []).reverse().map((m) => ({ role: m.role, content: m.content }));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: `Contexto do usuário:\n${contextBlock}` },
          ...recent,
          { role: "user", content: data.message },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("AI gateway error", response.status, detail);
      if (response.status === 429) {
        return { reply: "Muitas mensagens em pouco tempo. Tente novamente em alguns instantes." };
      }
      return { reply: "Não consegui responder agora. Tente novamente em instantes." };
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = payload.choices?.[0]?.message?.content?.trim() ?? "Não consegui responder agora.";

    await supabase.from("ai_messages").insert([
      { user_id: userId, role: "user", content: data.message },
      { user_id: userId, role: "assistant", content: reply },
    ]);

    return { reply };
  });
