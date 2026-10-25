import { createFileRoute } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/demandas")({
  head: () => ({
    meta: [
      { title: "Demandas — Alçada" },
      { name: "description", content: "Todas as demandas recebidas e seu andamento no fluxo." },
      { property: "og:title", content: "Demandas — Alçada" },
      { property: "og:description", content: "Todas as demandas recebidas e seu andamento no fluxo." },
    ],
  }),
  component: () => <PageSkeleton title="Demandas" description="Todas as demandas recebidas e seu andamento no fluxo." />,
});
