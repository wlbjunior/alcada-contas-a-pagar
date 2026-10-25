import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/integracao")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, servico: "alcada-integracao" }),
      POST: async ({ request }) => {
        const { verificarChave, processarAcao } = await import("@/lib/integracao.server");
        const negado = await verificarChave(request.headers.get("x-alcada-key"));
        if (negado) return Response.json(negado.body, { status: negado.status });
        let corpo: unknown;
        try {
          corpo = await request.json();
        } catch {
          return Response.json({ ok: false, erro: "json_invalido", detalhe: "corpo não é JSON válido" }, { status: 400 });
        }
        const r = await processarAcao(corpo);
        return Response.json(r.body, { status: r.status });
      },
    },
  },
});
