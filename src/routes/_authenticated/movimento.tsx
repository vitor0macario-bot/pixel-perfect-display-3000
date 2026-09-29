import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage } from "@/components/task-list";

export const Route = createFileRoute("/_authenticated/movimento")({
  head: () => ({
    meta: [
      { title: "Movimento — VIVA" },
      {
        name: "description",
        content: "As atividades de movimento da sua rotina, no tempo que você tem disponível.",
      },
      { property: "og:title", content: "Movimento — VIVA" },
      { property: "og:description", content: "Movimento no seu ritmo e no seu tempo." },
    ],
  }),
  component: () => (
    <CategoryPage
      title="Movimento"
      description="Atividades para movimentar o corpo no seu ritmo e no tempo que você informou."
      category="movimento"
    />
  ),
});
