import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage } from "@/components/task-list";

export const Route = createFileRoute("/_authenticated/alimentacao")({
  head: () => ({
    meta: [
      { title: "Alimentação — VIVA" },
      {
        name: "description",
        content: "As refeições equilibradas da sua rotina, organizadas conforme suas preferências.",
      },
      { property: "og:title", content: "Alimentação — VIVA" },
      { property: "og:description", content: "Refeições da sua rotina, do seu jeito." },
    ],
  }),
  component: () => (
    <CategoryPage
      title="Alimentação"
      description="Refeições equilibradas da sua rotina, montadas a partir das suas preferências alimentares."
      category="alimentacao"
    />
  ),
});
