import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, dataBR, dataHoraBR, rotaRotulo, statusInfo, STATUS, ROTAS } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/demandas")({
  validateSearch: (s: Record<string, unknown>) => ({
    status: typeof s["status"] === "string" ? s["status"] : "",
    rota: typeof s["rota"] === "string" ? s["rota"] : "",
    q: typeof s["q"] === "string" ? s["q"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Demandas — Alçada" },
      { name: "description", content: "Todas as demandas recebidas e seu andamento no fluxo." },
      { property: "og:title", content: "Demandas — Alçada" },
      { property: "og:description", content: "Todas as demandas recebidas e seu andamento no fluxo." },
    ],
  }),
  component: Demandas,
});

function Demandas() {
  const { status, rota, q } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ["demandas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandas")
        .select("id, codigo, canal, fornecedor_nome, valor, vencimento, status, rota, prioridade, criado_em")
        .order("criado_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`demandas-lista-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "demandas" }, () =>
        qc.invalidateQueries({ queryKey: ["demandas"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const filtradas = lista.filter((d) => {
    if (status && d.status !== status) return false;
    if (rota && (d.rota ?? "") !== rota) return false;
    if (q) {
      const t = q.toLowerCase();
      if (!d.codigo.toLowerCase().includes(t) && !(d.fornecedor_nome ?? "").toLowerCase().includes(t)) return false;
    }
    return true;
  });

  const setFiltro = (patch: Partial<{ status: string; rota: string; q: string }>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  return (
    <div>
      <PageHeader title="Demandas" description="Todas as demandas recebidas e seu andamento no fluxo." />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Buscar por código ou fornecedor…"
            className="w-72"
            value={q}
            onChange={(e) => setFiltro({ q: e.target.value })}
          />
          <Select value={status || "todas"} onValueChange={(v) => setFiltro({ status: v === "todas" ? "" : v })}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos os status</SelectItem>
              {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.rotulo}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={rota || "todas"} onValueChange={(v) => setFiltro({ rota: v === "todas" ? "" : v })}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Rota" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as rotas</SelectItem>
              {Object.entries(ROTAS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtradas.length} de {lista.length}</span>
        </div>

        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Canal</th>
                <th className="px-3 py-2">Fornecedor</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Rota</th>
                <th className="px-3 py-2">Prioridade</th>
                <th className="px-3 py-2">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Carregando…</td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  {lista.length === 0 ? "Nenhuma demanda ainda." : "Nenhuma demanda com estes filtros."}
                </td></tr>
              ) : filtradas.map((d) => {
                const st = statusInfo(d.status);
                return (
                  <tr
                    key={d.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                    onClick={() => navigate({ to: "/demandas/$id", params: { id: d.id } })}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{d.codigo}</td>
                    <td className="px-3 py-2">{d.canal}</td>
                    <td className="px-3 py-2">{d.fornecedor_nome || "—"}</td>
                    <td className="px-3 py-2 text-right num">{brl(d.valor)}</td>
                    <td className="px-3 py-2 num">{dataBR(d.vencimento)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${st.classe}`}>{st.rotulo}</span>
                    </td>
                    <td className="px-3 py-2">{rotaRotulo(d.rota)}</td>
                    <td className="px-3 py-2">{d.prioridade || "—"}</td>
                    <td className="px-3 py-2 num text-muted-foreground">{dataHoraBR(d.criado_em)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
