import { createFileRoute } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores — Alçada" },
      { name: "description", content: "Cadastro e homologação de fornecedores." },
      { property: "og:title", content: "Fornecedores — Alçada" },
      { property: "og:description", content: "Cadastro e homologação de fornecedores." },
    ],
  }),
  component: () => <PageSkeleton title="Fornecedores" description="Cadastro e homologação de fornecedores." />,
});
