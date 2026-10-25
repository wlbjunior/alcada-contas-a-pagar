import { createFileRoute } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/aprovacoes")({
  head: () => ({
    meta: [
      { title: "Aprovações — Alçada" },
      { name: "description", content: "Decisões humanas pendentes conforme as regras de alçada." },
      { property: "og:title", content: "Aprovações — Alçada" },
      { property: "og:description", content: "Decisões humanas pendentes conforme as regras de alçada." },
    ],
  }),
  component: () => <PageSkeleton title="Aprovações" description="Decisões humanas pendentes conforme as regras de alçada." />,
});
