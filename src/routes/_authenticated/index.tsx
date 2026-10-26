import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { brl, dataHoraBR, rotaRotulo, statusInfo } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Painel — Alçada" },
      { name: "description", content: "Visão geral das contas a pagar, filas e alertas do dia." },
      { property: "og:title", content: "Painel — Alçada" },
      { property: "og:description", content: "Visão geral das contas a pagar, filas e alertas do dia." },
    ],
  }),
  component: Painel,
});

const FUSO = "America/Fortaleza";
const inicioMes = () => {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit" }).format(new Date());
  return new Date(`${partes}-01T00:00:00-03:00`).toISOString();
};
const diaLocal = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date(iso));

function Kpi({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className="mt-1 truncate text-xl font-semibold num" title={valor}>{valor}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

const CONCLUIDAS = ["agendada", "aprovada", "aprovada_auto", "rejeitada", "descartada"];

function Painel() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["painel"],
    queryFn: async () => {
      const inicio = inicioMes();
      const [dem, apPend, pag, ev] = await Promise.all([
        supabase.from("demandas").select("id, codigo, status, rota, valor, criado_em").gte("criado_em", inicio).limit(2000),
        supabase.from("aprovacoes").select("id, prazo, demandas(codigo, fornecedor_nome, valor)").eq("status", "pendente").limit(100),
        supabase.from("pagamentos").select("valor").eq("status", "agendado"),
        supabase.from("eventos").select("demanda_id, criado_em").order("criado_em", { ascending: true }).limit(5000),
      ]);
      const demandas = dem.data ?? [];
      const pendentes = (apPend.data ?? []) as unknown as {
        id: string; prazo: string | null;
        demandas: { codigo: string; fornecedor_nome: string | null; valor: number | null } | null;
      }[];
      const valorAgendado = (pag.data ?? []).reduce((a, p) => a + (p.valor ?? 0), 0);

      const total = demandas.length;
      const automaticas = demandas.filter((d) => d.rota === "automatica").length;
      const humanas = demandas.filter((d) => d.rota === "aprovacao" || d.rota === "excecao").length;
      const erros = demandas.filter((d) => d.status === "erro").length;
      const escaladas = demandas.filter((d) => d.status === "escalada");

      // Tempo médio ponta a ponta das demandas concluídas (1º → último evento)
      const concluidas = new Set(demandas.filter((d) => CONCLUIDAS.includes(d.status)).map((d) => d.id));
      const span = new Map<string, { min: number; max: number }>();
      for (const e of ev.data ?? []) {
        if (!e.demanda_id || !concluidas.has(e.demanda_id)) continue;
        const t = new Date(e.criado_em).getTime();
        const s = span.get(e.demanda_id);
        if (s) { s.min = Math.min(s.min, t); s.max = Math.max(s.max, t); }
        else span.set(e.demanda_id, { min: t, max: t });
      }
      const duracoes = [...span.values()].map((s) => s.max - s.min).filter((x) => x > 0);
      const mediaMs = duracoes.length ? duracoes.reduce((a, b) => a + b, 0) / duracoes.length : null;

      // Gráficos
      const porRota = Object.entries(
        demandas.reduce<Record<string, number>>((acc, d) => {
          const r = rotaRotulo(d.rota);
          acc[r] = (acc[r] ?? 0) + 1;
          return acc;
        }, {}),
      ).map(([rota, quantidade]) => ({ rota, quantidade }));

      const dias: { dia: string; quantidade: number }[] = [];
      const hoje = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(hoje.getTime() - i * 86400000);
        dias.push({ dia: new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" }).format(d), quantidade: 0 });
      }
      const idx = new Map(dias.map((d, i) => [d.dia, i]));
      for (const d of demandas) {
        const rotuloDia = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" }).format(new Date(d.criado_em));
        const i = idx.get(rotuloDia);
        const dia = i != null ? dias[i] : undefined;
        if (dia) dia.quantidade += 1;
      }

      const agora = Date.now();
      const pertoDoPrazo = pendentes.filter((p) => p.prazo && new Date(p.prazo).getTime() - agora < 24 * 3.6e6);
      const comErro = demandas.filter((d) => d.status === "erro");

      return {
        total, automaticas, humanas, erros, escaladas, comErro,
        pendentes: pendentes.length, pertoDoPrazo, valorAgendado, mediaMs,
        porRota, porDia: dias,
      };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`painel-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "demandas" }, () => qc.invalidateQueries({ queryKey: ["painel"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "aprovacoes" }, () => qc.invalidateQueries({ queryKey: ["painel"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const pct = (n: number, t: number) => (t ? `${Math.round((n / t) * 100)}%` : "—");
  const duracao = (ms: number | null) => {
    if (ms == null) return "—";
    const h = ms / 3.6e6;
    return h >= 24 ? `${(h / 24).toFixed(1).replace(".", ",")} dias` : `${h.toFixed(1).replace(".", ",")} h`;
  };

  return (
    <div>
      <PageHeader title="Painel" description="Visão geral das contas a pagar, filas e alertas do dia." />
      <div className="space-y-6 p-6">
        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data.total === 0 ? (
          <div className="rounded-md border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
            Nenhuma demanda ainda neste mês. Envie a primeira em "Nova demanda".
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              <Kpi rotulo="Recebidas no mês" valor={String(data.total)} />
              <Kpi rotulo="Automáticas" valor={pct(data.automaticas, data.total)} sub={`${data.automaticas} demandas`} />
              <Kpi rotulo="Exigiram humano" valor={pct(data.humanas, data.total)} sub={`${data.humanas} demandas`} />
              <Kpi rotulo="Aprovações pendentes" valor={String(data.pendentes)} />
              <Kpi rotulo="Valor agendado" valor={brl(data.valorAgendado)} />
              <Kpi rotulo="Tempo médio ponta a ponta" valor={duracao(data.mediaMs)} sub="demandas concluídas" />
              <Kpi rotulo="Taxa de erro" valor={pct(data.erros, data.total)} sub={`${data.erros} demandas`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-md border bg-card p-4">
                <h2 className="mb-3 text-sm font-semibold">Demandas por rota (mês)</h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.porRota}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="rota" fontSize={12} />
                      <YAxis allowDecimals={false} fontSize={12} width={28} />
                      <Tooltip />
                      <Bar dataKey="quantidade" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="rounded-md border bg-card p-4">
                <h2 className="mb-3 text-sm font-semibold">Demandas por dia (últimos 14 dias)</h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.porDia}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="dia" fontSize={11} />
                      <YAxis allowDecimals={false} fontSize={12} width={28} />
                      <Tooltip />
                      <Bar dataKey="quantidade" fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>

            <section className="rounded-md border bg-card">
              <h2 className="border-b px-4 py-2.5 text-sm font-semibold">Atenção agora</h2>
              <div className="divide-y">
                {data.pertoDoPrazo.length === 0 && data.comErro.length === 0 && data.escaladas.length === 0 && (
                  <p className="px-4 py-6 text-sm text-muted-foreground">Nada pedindo atenção agora.</p>
                )}
                {data.pertoDoPrazo.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <Clock className="h-4 w-4 shrink-0 text-warning" />
                    <span>
                      Aprovação de <span className="font-mono text-xs">{p.demandas?.codigo}</span>
                      {p.demandas?.fornecedor_nome ? ` · ${p.demandas.fornecedor_nome}` : ""} vence em menos de 24 h
                    </span>
                    <Link to="/aprovacoes" className="ml-auto text-xs text-primary underline">Decidir</Link>
                  </div>
                ))}
                {data.comErro.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                    <span><span className="font-mono text-xs">{d.codigo}</span> está com erro no processamento</span>
                    <Link to="/demandas/$id" params={{ id: d.id }} className="ml-auto text-xs text-primary underline">Abrir</Link>
                  </div>
                ))}
                {data.escaladas.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                    <span><span className="font-mono text-xs">{d.codigo}</span> foi escalada</span>
                    <Link to="/demandas/$id" params={{ id: d.id }} className="ml-auto text-xs text-primary underline">Abrir</Link>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
