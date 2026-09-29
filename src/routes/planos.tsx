import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PLANS, startCheckout } from "@/lib/subscription";
import { useAuth } from "@/lib/auth";
import { requestProInterest } from "@/lib/subscription";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos VIVA — Free e Pro" },
      {
        name: "description",
        content:
          "Compare o plano Free (quiz, plano inicial, check-in e progresso básico) com o Pro (VIVA AI, histórico completo e metas avançadas).",
      },
      { property: "og:title", content: "Planos VIVA — Free e Pro" },
      { property: "og:description", content: "Comece grátis e evolua para o Pro quando quiser." },
    ],
  }),
  component: PlanosPage,
});

function PlanosPage() {
  const { user } = useAuth();

  async function handleSelect(plan: "free" | "pro") {
    if (plan === "free") {
      toast.success("O plano Free já está disponível para você.");
      return;
    }
    const result = await startCheckout("pro");
    if (result.status === "unavailable") {
      if (user) await requestProInterest(user.id);
      toast.info(result.message);
    }
  }

  return (
    <div className="min-h-screen bg-hero-glow px-5 py-14">
      <div className="mx-auto max-w-5xl">
        <Link to="/" className="font-display text-sm tracking-[0.3em] text-muted-foreground">
          VIVA
        </Link>
        <h1 className="mt-6 font-display text-3xl font-semibold sm:text-4xl">
          Escolha como quer acompanhar sua rotina
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Comece de graça. O plano Pro adiciona a VIVA AI e personalização contínua.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`panel p-8 ${plan.id === "pro" ? "border-primary/40 shadow-glow" : ""}`}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">{plan.name}</h2>
                {plan.id === "pro" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft/60 px-3 py-1 text-xs text-primary">
                    <Sparkles className="size-3" /> Recomendado
                  </span>
                ) : null}
              </div>
              <p className="mt-4 font-display text-4xl font-semibold">{plan.price}</p>
              <p className="text-sm text-muted-foreground">{plan.period}</p>
              <p className="mt-4 text-sm text-muted-foreground">{plan.description}</p>
              <ul className="mt-6 space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSelect(plan.id)}
                className={`mt-8 w-full rounded-full px-6 py-3.5 font-semibold transition-transform hover:-translate-y-0.5 ${
                  plan.id === "pro"
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "border border-border bg-surface text-foreground"
                }`}
              >
                {plan.id === "pro" ? "Quero o Pro" : "Começar no Free"}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-10 max-w-2xl text-xs text-muted-foreground">
          O pagamento recorrente ainda não está ativo neste app. Nenhuma cobrança é realizada e
          nenhum valor é processado até que um provedor de pagamento seja conectado.
        </p>
      </div>
    </div>
  );
}
