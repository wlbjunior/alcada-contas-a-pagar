import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { dataHoraBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/observabilidade")({
  head: () => ({
    meta: [
      { title: "Observabilidade — Alçada" },
      { name: "description", content: "Trilha de eventos, execuções do orquestrador e chamadas de IA." },
      { property: "og:title", content: "Observabilidade — Alçada" },
      { property: "og:description", content: "Trilha de eventos, execuções do orquestrador e chamadas de IA." },
    ],
  }),
  component: Observabilidade,
});

const FUNIL: { rotulo: string; etapas: string[] }[] = [
  { rotulo: "Recebida", etapas: ["recebida", "recebimento", "envio", "entrada"] },
  { rotulo: "IA", etapas: ["ia", "extracao", "extração", "analise", "análise", "classificacao"] },
  { rotulo: "Decisão", etapas: ["decisao", "decisão", "checagem", "regra", "aprovacao", "aprovação"] },
  { rotulo: "Ação", etapas: ["acao", "ação", "retomada", "pagamento", "agendamento", "escalada"] },
  { rotulo: "Registro", etapas: ["registro", "conclusao", "conclusão", "final", "arquivo"] },
];

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border bg-card">
      <h2 className="border-b px-4 py-2.5 text-sm font-semibold">{titulo}</h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Observabilidade() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["observabilidade"],
    queryFn: async () => {
      const [ia, evErro, evEtapas, dem] = await Promise.all([
        supabase.from("ia_execucoes").select("*").order("criado_em", { ascending: false }).limit(500),
        supabase.from("eventos").select("id, demanda_id, etapa, mensagem, execution_id, criado_em").eq("tipo", "erro")
          .order("criado_em", { ascending: false }).limit(30),
        supabase.from("eventos").select("demanda_id, etapa").limit(10000),
        supabase.from("demandas").select("motivos").limit(2000),
      ]);

      const execs = ia.data ?? [];
      const porModelo = new Map<string, { n: number; lat: number[]; ok: number }>();
      for (const e of execs) {
        const m = e.modelo || "desconhecido";
        const g = porModelo.get(m) ?? { n: 0, lat: [], ok: 0 };
        g.n += 1;
        if (e.latencia_ms != null) g.lat.push(e.latencia_ms);
        if (e.sucesso) g.ok += 1;
        porModelo.set(m, g);
      }
      const modelos = [...porModelo.entries()].map(([modelo, g]) => {
        const ord = [...g.lat].sort((a, b) => a - b);
        const p95 = ord.length ? ord[Math.min(ord.length - 1, Math.ceil(ord.length * 0.95) - 1)] : null;
        const media = ord.length ? Math.round(ord.reduce((a, b) => a + b, 0) / ord.length) : null;
        return { modelo, n: g.n, media, p95, sucesso: g.n ? Math.round((g.ok / g.n) * 100) : null };
      });
      const comErro = execs.filter((e) => e.sucesso === false).slice(0, 20);

      // Funil: demandas distintas que chegaram a cada etapa
      const porDemanda = new Map<string, Set<string>>();
      for (const e of evEtapas.data ?? []) {
        if (!e.demanda_id || !e.etapa) continue;
        const s = porDemanda.get(e.demanda_id) ?? new Set<string>();
        s.add(e.etapa.toLowerCase());
        porDemanda.set(e.demanda_id, s);
      }
      const funil = FUNIL.map((f) => ({
        rotulo: f.rotulo,
        total: [...porDemanda.values()].filter((s) => f.etapas.some((et) => [...s].some((x) => x.includes(et)))).length,
      }));
      const funilMax = Math.max(1, ...funil.map((f) => f.total));

      // Motivos que mais mandam para humano
      const contagem = new Map<string, number>();
      for (const d of dem.data ?? []) {
        for (const m of d.motivos ?? []) contagem.set(m, (contagem.get(m) ?? 0) + 1);
      }
      const motivos = [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      const motivoMax = Math.max(1, ...motivos.map(([, n]) => n));

      return { modelos, comErro, erros: evErro.data ?? [], funil, funilMax, motivos, motivoMax };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`obs-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos" }, () => qc.invalidateQueries({ queryKey: ["observabilidade"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "ia_execucoes" }, () => qc.invalidateQueries({ queryKey: ["observabilidade"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div>
      <PageHeader title="Observabilidade" description="Trilha de eventos, execuções do orquestrador e chamadas de IA." />
      <div className="grid gap-4 p-6 lg:grid-cols-2">
        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <Secao titulo="Execuções de IA">
              {data.modelos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma execução de IA registrada ainda.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-xs text-muted-foreground">
                    <tr><th className="py-1.5">Modelo</th><th className="py-1.5 text-right">Execuções</th><th className="py-1.5 text-right">Latência média</th><th className="py-1.5 text-right">p95</th><th className="py-1.5 text-right">Sucesso</th></tr>
                  </thead>
                  <tbody>
                    {data.modelos.map((m) => (
                      <tr key={m.modelo} className="border-b last:border-0">
                        <td className="py-1.5 font-mono text-xs">{m.modelo}</td>
                        <td className="py-1.5 text-right num">{m.n}</td>
                        <td className="py-1.5 text-right num">{m.media != null ? `${m.media} ms` : "—"}</td>
                        <td className="py-1.5 text-right num">{m.p95 != null ? `${m.p95} ms` : "—"}</td>
                        <td className="py-1.5 text-right num">{m.sucesso != null ? `${m.sucesso}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {data.comErro.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Últimas execuções com erro ({data.comErro.length})</div>
                  <ul className="max-h-56 space-y-1 overflow-auto text-xs">
                    {data.comErro.map((e) => (
                      <li key={e.id} className="rounded bg-destructive/10 px-2 py-1">
                        <span className="num text-muted-foreground">{dataHoraBR(e.criado_em)}</span> · {e.erro || "erro sem detalhe"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Secao>

            <Secao titulo="Erros recentes">
              {data.erros.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento de erro registrado.</p>
              ) : (
                <ul className="max-h-80 space-y-1.5 overflow-auto text-sm">
                  {data.erros.map((e) => (
                    <li key={e.id} className="rounded bg-destructive/10 px-2.5 py-1.5">
                      <div>{e.mensagem || "Erro"}</div>
                      <div className="text-xs text-muted-foreground">
                        <span className="num">{dataHoraBR(e.criado_em)}</span>
                        {e.etapa && <> · etapa {e.etapa}</>}
                        {e.execution_id && <> · <span className="font-mono">exec {e.execution_id}</span></>}
                        {e.demanda_id && (
                          <> · <Link to="/demandas/$id" params={{ id: e.demanda_id }} className="text-primary underline">demanda</Link></>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Secao>

            <Secao titulo="Funil por etapa">
              {data.funil.every((f) => f.total === 0) ? (
                <p className="text-sm text-muted-foreground">Sem eventos suficientes para montar o funil.</p>
              ) : (
                <div className="space-y-2">
                  {data.funil.map((f) => (
                    <div key={f.rotulo} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-sm">{f.rotulo}</span>
                      <div className="h-5 rounded-sm bg-chart-1/80" style={{ width: `${Math.max(2, (f.total / data.funilMax) * 100)}%` }} />
                      <span className="text-sm num text-muted-foreground">{f.total}</span>
                    </div>
                  ))}
                  <p className="pt-1 text-xs text-muted-foreground">Demandas distintas que chegaram a cada etapa, pelos eventos registrados.</p>
                </div>
              )}
            </Secao>

            <Secao titulo="Motivos que mais mandam para humano">
              {data.motivos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum motivo registrado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {data.motivos.map(([m, n]) => (
                    <div key={m} className="flex items-center gap-3">
                      <span className="w-56 shrink-0 truncate text-sm" title={m}>{m}</span>
                      <div className="h-5 rounded-sm bg-chart-3/80" style={{ width: `${Math.max(2, (n / data.motivoMax) * 100)}%` }} />
                      <span className="text-sm num text-muted-foreground">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </Secao>
          </>
        )}
      </div>
    </div>
  );
}
