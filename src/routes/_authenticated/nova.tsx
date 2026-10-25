import { createFileRoute } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/nova")({
  head: () => ({
    meta: [
      { title: "Nova demanda — Alçada" },
      { name: "description", content: "Registre uma nota fiscal, boleto ou cobrança para processamento." },
      { property: "og:title", content: "Nova demanda — Alçada" },
      { property: "og:description", content: "Registre uma nota fiscal, boleto ou cobrança para processamento." },
    ],
  }),
  component: () => <PageSkeleton title="Nova demanda" description="Registre uma nota fiscal, boleto ou cobrança para processamento." />,
});
