import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { applyQuizPlan, ensureProfile } from "@/lib/data";
import { QUIZ_STORAGE_KEY, type QuizAnswers } from "@/lib/viva";

const searchSchema = z.object({
  mode: z.enum(["login", "signup", "reset"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Entrar no VIVA" },
      {
        name: "description",
        content: "Acesse sua conta VIVA para ver sua rotina personalizada, check-ins e progresso.",
      },
      { property: "og:title", content: "Entrar no VIVA" },
      { property: "og:description", content: "Acesse sua rotina personalizada e seu progresso." },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "reset";

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>(search.mode ?? "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    void finishSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  async function finishSession() {
    if (!user) return;
    await ensureProfile(user.id, name || user.email?.split("@")[0] || "você");
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(QUIZ_STORAGE_KEY) : null;
    if (stored) {
      try {
        const answers = JSON.parse(stored) as QuizAnswers;
        await applyQuizPlan(user.id, answers);
        window.localStorage.removeItem(QUIZ_STORAGE_KEY);
      } catch (error) {
        console.error(error);
      }
    }
    navigate({ to: "/inicio" });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Se pedirmos confirmação, verifique seu e-mail.");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/configuracoes`,
        });
        if (error) throw error;
        toast.success("Enviamos um link de recuperação para o seu e-mail.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível continuar.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar com o Google.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero-glow px-5 py-14">
      <div className="w-full max-w-md rise-in">
        <Link to="/" className="font-display text-sm tracking-[0.3em] text-muted-foreground">
          VIVA
        </Link>
        <h1 className="mt-6 font-display text-3xl font-semibold">
          {mode === "signup"
            ? "Criar sua conta"
            : mode === "login"
              ? "Entrar na sua conta"
              : "Recuperar senha"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {mode === "signup"
            ? "Seus dados de rotina e progresso ficam salvos na sua conta."
            : mode === "login"
              ? "Bem-vindo de volta. Continue sua rotina."
              : "Enviaremos um link para você definir uma nova senha."}
        </p>

        <form onSubmit={handleSubmit} className="panel mt-8 space-y-4 p-6">
          {mode === "signup" ? (
            <Field label="Seu nome">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input-base"
                placeholder="Como quer ser chamado"
              />
            </Field>
          ) : null}

          <Field label="E-mail">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-base"
              placeholder="voce@email.com"
            />
          </Field>

          {mode !== "reset" ? (
            <Field label="Senha">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="input-base"
                placeholder="Mínimo de 6 caracteres"
              />
            </Field>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "signup" ? "Criar conta" : mode === "login" ? "Entrar" : "Enviar link"}
          </button>

          {mode !== "reset" ? (
            <>
              <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                ou
                <span className="h-px flex-1 bg-border" />
              </div>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="inline-flex w-full items-center justify-center rounded-full border border-border bg-surface px-6 py-3.5 font-medium transition-colors hover:bg-surface-strong disabled:opacity-60"
              >
                Continuar com Google
              </button>
            </>
          ) : null}
        </form>

        <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              <p>
                Não tem conta?{" "}
                <button onClick={() => setMode("signup")} className="text-primary hover:underline">
                  Criar agora
                </button>
              </p>
              <p>
                <button onClick={() => setMode("reset")} className="hover:text-foreground">
                  Esqueci minha senha
                </button>
              </p>
            </>
          ) : (
            <p>
              Já tem conta?{" "}
              <button onClick={() => setMode("login")} className="text-primary hover:underline">
                Entrar
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs tracking-wide text-muted-foreground uppercase">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
