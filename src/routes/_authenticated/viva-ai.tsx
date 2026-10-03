import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { chatWithViva, getVivaUsage } from "@/lib/ai.functions";
import { fetchProfile } from "@/lib/data";
import { isPro } from "@/lib/subscription";

export const Route = createFileRoute("/_authenticated/viva-ai")({
  head: () => ({
    meta: [
      { title: "VIVA AI — ajuste sua rotina" },
      {
        name: "description",
        content: "Converse com a VIVA AI para reorganizar seu dia e criar metas pequenas e possíveis.",
      },
      { property: "og:title", content: "VIVA AI — ajuste sua rotina" },
      { property: "og:description", content: "Reorganize seu dia sem punição, com pequenas metas." },
    ],
  }),
  component: VivaAiPage,
});

type Message = { role: string; content: string };

const SUGGESTIONS = [
  "Hoje estou sem tempo.",
  "Não consegui fazer minha atividade.",
  "Quero melhorar minha consistência.",
];

function VivaAiPage() {
  const { user } = useAuth();
  const send = useServerFn(chatWithViva);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: () => fetchProfile(user!.id),
  });

  const history = useQuery({
    queryKey: ["ai-messages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_messages")
        .select("role, content")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(40);
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    if (history.data) setMessages(history.data);
  }, [history.data]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const usageFn = useServerFn(getVivaUsage);
  const usage = useQuery({ queryKey: ["viva-usage", user?.id], enabled: !!user, queryFn: () => usageFn() });
  const pro = usage.data?.pro ?? isPro(profile.data?.plan);
  const limit = usage.data?.limit ?? 5;
  const used = usage.data?.used ?? 0;
  const remaining = pro ? Infinity : Math.max(0, limit - used);
  const blocked = !pro && remaining <= 0;

  async function handleSend(text: string) {
    const message = text.trim();
    if (!message || sending || blocked) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setSending(true);
    try {
      const result = await send({ data: { message } });
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
      usage.refetch();
    } catch (error) {
      console.error(error);
      toast.error("Não conseguimos falar com a VIVA AI agora.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fade-in-soft flex min-h-[70vh] flex-col">
      <header>
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">VIVA AI</h1>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Conhece seu quiz, sua rotina e seus check-ins para ajudar a reorganizar o dia.
        </p>
      </header>

      <div className="panel mt-6 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        {pro ? (
          <span className="text-muted-foreground">Plano Pro · perguntas ilimitadas</span>
        ) : (
          <>
            <span className="text-muted-foreground">
              Plano Free · <span className="font-semibold text-foreground">{remaining}</span> de {limit} perguntas restantes hoje
            </span>
            <Link to="/planos" className="rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
              Ilimitado com Pro
            </Link>
          </>
        )}
      </div>

      <div className="mt-8 flex-1 space-y-4">
        {messages.length === 0 && !sending ? (
          <div className="panel p-6 text-sm text-muted-foreground">
            Comece com uma dessas mensagens:
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="rounded-full border border-border bg-surface px-4 py-2 text-xs text-foreground transition-colors hover:bg-surface-strong"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              message.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "border border-border bg-surface/70"
            }`}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}

        {sending ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface/70 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Pensando com você...
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSend(input);
        }}
        className="sticky bottom-20 mt-6 flex items-center gap-2 rounded-full border border-border bg-surface/90 p-2 backdrop-blur-xl lg:bottom-4"
      >
        <input disabled={blocked}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Como está seu dia hoje?"
          className="flex-1 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={sending || blocked || !input.trim()}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground disabled:opacity-40"
          aria-label="Enviar mensagem"
        >
          <Send className="size-4" />
        </button>
      </form>

      <p className="mt-4 text-xs text-muted-foreground">
        A VIVA AI ajuda a organizar hábitos. Não faz diagnóstico nem indica tratamentos.
      </p>
    </div>
  );
}
