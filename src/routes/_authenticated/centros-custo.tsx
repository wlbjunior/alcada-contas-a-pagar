import { createFileRoute } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/centros-custo")({
  head: () => ({
    meta: [
      { title: "Centros de custo — Alçada" },
      { name: "description", content: "Centros de custo e orçamento mensal disponível." },
      { property: "og:title", content: "Centros de custo — Alçada" },
      { property: "og:description", content: "Centros de custo e orçamento mensal disponível." },
    ],
  }),
  component: () => <PageSkeleton title="Centros de custo" description="Centros de custo e orçamento mensal disponível." />,
});
