import { createFileRoute } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/observabilidade")({
  head: () => ({
    meta: [
      { title: "Observabilidade — Alçada" },
      { name: "description", content: "Trilha de eventos, execuções do orquestrador e chamadas de IA." },
      { property: "og:title", content: "Observabilidade — Alçada" },
      { property: "og:description", content: "Trilha de eventos, execuções do orquestrador e chamadas de IA." },
    ],
  }),
  component: () => <PageSkeleton title="Observabilidade" description="Trilha de eventos, execuções do orquestrador e chamadas de IA." />,
});
