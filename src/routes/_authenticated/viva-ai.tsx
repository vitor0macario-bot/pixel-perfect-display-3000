import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Send, Sparkles, Trash2, X } from "lucide-react";
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

  const [conversationId, setConversationId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const trimmedSearch = search.trim();

  const conversations = useQuery({
    queryKey: ["ai-conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_conversations")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const searchResults = useQuery({
    queryKey: ["ai-conversations-search", user?.id, trimmedSearch],
    enabled: !!user && trimmedSearch.length >= 2,
    queryFn: async () => {
      const { data: hits } = await supabase
        .from("ai_messages")
        .select("conversation_id")
        .eq("user_id", user!.id)
        .ilike("content", `%${trimmedSearch}%`)
        .order("created_at", { ascending: false })
        .limit(200);
      const ids = [...new Set((hits ?? []).map((h) => h.conversation_id).filter(Boolean))] as string[];
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("id, title, updated_at")
        .in("id", ids)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const cutoffISO = (): string | null => {
    if (dateFilter === "all") return null;
    const now = new Date();
    if (dateFilter === "today") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start.toISOString();
    }
    const days = dateFilter === "week" ? 7 : 30;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  };

  const historyList = trimmedSearch.length >= 2 ? (searchResults.data ?? []) : (conversations.data ?? []);
  const cutoff = cutoffISO();
  const visibleConversations = historyList.filter((c) => !cutoff || c.updated_at >= cutoff);
  const historyLoading =
    (trimmedSearch.length >= 2 ? searchResults.isLoading : conversations.isLoading);
  const historyLabel =
    trimmedSearch.length >= 2
      ? "Resultados da busca"
      : dateFilter === "all"
        ? "Conversas anteriores"
        : dateFilter === "today"
          ? "Conversas de hoje"
          : dateFilter === "week"
            ? "Conversas dos últimos 7 dias"
            : "Conversas dos últimos 30 dias";

  async function deleteConversation(id: string) {
    if (!window.confirm("Excluir esta conversa? Isso apaga todas as mensagens dela.")) return;
    try {
      await supabase.from("ai_messages").delete().eq("conversation_id", id);
      const { error } = await supabase.from("ai_conversations").delete().eq("id", id);
      if (error) throw error;
      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
      }
      conversations.refetch();
      if (trimmedSearch.length >= 2) searchResults.refetch();
      toast.success("Conversa excluída.");
    } catch (error) {
      console.error(error);
      toast.error("Não conseguimos excluir a conversa agora.");
    }
  }

  async function openConversation(id: string) {
    setConversationId(id);
    const { data } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as Message[]);
  }

  function newConversation() {
    setConversationId(null);
    setMessages([]);
  }

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
      const result = await send({ data: { message, conversationId } });
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
      if ("conversationId" in result && result.conversationId) {
        setConversationId(result.conversationId);
        conversations.refetch();
      }
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

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar nas conversas..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Buscar conversas"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpar busca"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              { value: "all", label: "Todas" },
              { value: "today", label: "Hoje" },
              { value: "week", label: "7 dias" },
              { value: "month", label: "30 dias" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              onClick={() => setDateFilter(option.value)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-xs transition-colors ${
                dateFilter === option.value
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-surface text-muted-foreground hover:bg-surface-strong"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={newConversation}
          className={`shrink-0 rounded-full border px-4 py-2 text-xs transition-colors ${conversationId === null ? "border-primary bg-primary/15 text-foreground" : "border-border bg-surface text-muted-foreground hover:bg-surface-strong"}`}
        >
          + Nova conversa
        </button>
        {visibleConversations.map((c) => (
          <div
            key={c.id}
            className={`flex max-w-[15rem] shrink-0 items-center gap-1 rounded-full border pl-2 pr-1.5 text-xs transition-colors ${
              conversationId === c.id
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border bg-surface text-muted-foreground hover:bg-surface-strong"
            }`}
          >
            <button
              onClick={() => openConversation(c.id)}
              title={c.title}
              className="max-w-[11.5rem] truncate py-2 pl-1"
            >
              {c.title}
            </button>
            <button
              onClick={() => deleteConversation(c.id)}
              title="Excluir conversa"
              aria-label={`Excluir conversa: ${c.title}`}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      {visibleConversations.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {historyLoading
            ? "Buscando..."
            : trimmedSearch.length >= 2
              ? `Nenhuma conversa encontrada para "${trimmedSearch}".`
              : cutoff
                ? "Nenhuma conversa nesse período."
                : "Nenhuma conversa anterior ainda."}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{historyLabel}</p>
      )}

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
