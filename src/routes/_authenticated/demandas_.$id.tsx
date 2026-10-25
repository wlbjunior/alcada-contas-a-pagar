import { createFileRoute } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/demandas_/$id")({
  head: () => ({
    meta: [
      { title: "Demanda — Alçada" },
      { name: "description", content: "Detalhes, checagens e linha do tempo da demanda." },
      { property: "og:title", content: "Demanda — Alçada" },
      { property: "og:description", content: "Detalhes, checagens e linha do tempo da demanda." },
    ],
  }),
  component: () => <PageSkeleton title="Demanda" description="Detalhes, checagens e linha do tempo da demanda." />,
});
