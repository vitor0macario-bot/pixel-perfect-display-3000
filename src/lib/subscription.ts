import { supabase } from "@/integrations/supabase/client";

/**
 * Camada de serviço de assinatura.
 * Nenhuma cobrança é simulada aqui: enquanto um gateway de pagamento não
 * estiver configurado, `startCheckout` apenas informa que a etapa de pagamento
 * ainda não está disponível. Quando o gateway existir, basta implementar
 * `createCheckoutSession` chamando a rota do provedor.
 */

export type PlanId = "free" | "pro";

export const PLANS: {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
}[] = [
  {
    id: "free",
    name: "Free",
    price: "R$ 0",
    period: "para sempre",
    description: "Para começar a organizar sua rotina.",
    features: [
      "Quiz inicial",
      "Plano inicial personalizado",
      "Check-in básico do dia",
      "Progresso básico",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 29",
    period: "por mês",
    description: "Para quem quer acompanhamento contínuo.",
    features: [
      "VIVA AI para ajustar sua rotina",
      "Personalização avançada",
      "Histórico completo",
      "Ajustes automáticos da rotina",
      "Biblioteca de conteúdos",
      "Metas avançadas",
    ],
  },
];

export type CheckoutResult =
  | { status: "unavailable"; message: string }
  | { status: "redirect"; url: string };

export async function startCheckout(_plan: PlanId): Promise<CheckoutResult> {
  return {
    status: "unavailable",
    message:
      "O pagamento recorrente ainda não está ativo. A arquitetura já está pronta: quando um provedor for conectado, a assinatura é ativada aqui mesmo.",
  };
}

export async function requestProInterest(userId: string) {
  await supabase
    .from("subscriptions")
    .upsert(
      { user_id: userId, plan: "free", status: "interested_pro", provider: null },
      { onConflict: "user_id" },
    );
}

export function isPro(plan?: string | null) {
  return plan === "pro";
}
