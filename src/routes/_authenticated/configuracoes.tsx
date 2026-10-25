import { createFileRoute } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Alçada" },
      { name: "description", content: "Limites de alçada, confiança mínima e prazos do fluxo." },
      { property: "og:title", content: "Configurações — Alçada" },
      { property: "og:description", content: "Limites de alçada, confiança mínima e prazos do fluxo." },
    ],
  }),
  component: () => <PageSkeleton title="Configurações" description="Limites de alçada, confiança mínima e prazos do fluxo." />,
});
