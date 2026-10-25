import { createFileRoute } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Painel — Alçada" },
      { name: "description", content: "Visão geral das contas a pagar, filas e alertas do dia." },
      { property: "og:title", content: "Painel — Alçada" },
      { property: "og:description", content: "Visão geral das contas a pagar, filas e alertas do dia." },
    ],
  }),
  component: () => <PageSkeleton title="Painel" description="Visão geral das contas a pagar, filas e alertas do dia." />,
});
