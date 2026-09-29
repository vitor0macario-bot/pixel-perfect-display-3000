import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage } from "@/components/task-list";

export const Route = createFileRoute("/_authenticated/habitos")({
  head: () => ({
    meta: [
      { title: "Hábitos — VIVA" },
      {
        name: "description",
        content: "Os pequenos hábitos que você escolheu melhorar, acompanhados todos os dias.",
      },
      { property: "og:title", content: "Hábitos — VIVA" },
      { property: "og:description", content: "Pequenos hábitos, acompanhados dia a dia." },
    ],
  }),
  component: () => (
    <CategoryPage
      title="Hábitos"
      description="Os hábitos que você escolheu melhorar primeiro, em passos pequenos e possíveis."
      category="habitos"
    />
  ),
});
