import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Check, X, Sparkles, Bot, Workflow, User, AppWindow, ChevronDown, ChevronRight, RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { reenviarDemanda, reprocessarRetomada } from "@/lib/fluxo.functions";
import { brl, dataBR, dataHoraBR, rotaRotulo, statusInfo, CHECAGENS, valorChecagem } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/demandas_/$id")({
  head: () => ({
    meta: [
      { title: "Demanda — Alçada" },
      { name: "description", content: "Detalhes, checagens e linha do tempo da demanda." },
      { property: "og:title", content: "Demanda — Alçada" },
      { property: "og:description", content: "Detalhes, checagens e linha do tempo da demanda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DemandaDetalhe,
  notFoundComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Demanda não encontrada. <Link to="/demandas" search={{ status: "", rota: "", q: "" }} className="underline">Voltar</Link></div>
  ),
});

const ORIGEM_ICONE: Record<string, typeof Bot> = { n8n: Workflow, ia: Bot, humano: User, app: AppWindow };
const TIPO_COR: Record<string, string> = {
  erro: "text-destructive", decisao: "text-success", info: "text-chart-1", alerta: "text-warning",
};

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border bg-card">
      <h2 className="border-b px-4 py-2.5 text-sm font-semibold">{titulo}</h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className="text-sm font-medium">{valor ?? "—"}</div>
    </div>
  );
}

function DemandaDetalhe() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [textoAberto, setTextoAberto] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const reenviar = useServerFn(reenviarDemanda);
  const [reprocessando, setReprocessando] = useState(false);
  const reprocessar = useServerFn(reprocessarRetomada);

  const { data: eu } = useQuery({
    queryKey: ["meus-papeis-det"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user?.id ?? "");
      return (r ?? []).map((x) => x.role);
    },
  });
  const gestor = (eu ?? []).some((r) => r === "gestor" || r === "admin");

  const { data: demanda, isLoading } = useQuery({
    queryKey: ["demanda", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("demandas").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: aprovacao } = useQuery({
    queryKey: ["demanda-aprovacao", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("aprovacoes").select("*").eq("demanda_id", id).order("criado_em", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const { data: pagamento } = useQuery({
    queryKey: ["demanda-pagamento", id],
    queryFn: async () => {
      const { data } = await supabase.from("pagamentos").select("*").eq("demanda_id", id).maybeSingle();
      return data;
    },
  });

  const { data: eventos = [] } = useQuery({
    queryKey: ["demanda-eventos", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("eventos").select("*").eq("demanda_id", id).order("criado_em", { ascending: true }).order("id", { ascending: true });
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`demanda-det-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "demandas", filter: `id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["demanda", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos", filter: `demanda_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["demanda-eventos", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "aprovacoes", filter: `demanda_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["demanda-aprovacao", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "pagamentos", filter: `demanda_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["demanda-pagamento", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  async function reenviarAgora() {
    setReenviando(true);
    try {
      const r = await reenviar({ data: { demanda_id: id } });
      if (r.enviado) toast.success(`Demanda ${r.codigo} reenviada ao orquestrador.`);
      else toast.warning("Reenvio tentado, mas o orquestrador não confirmou.");
      qc.invalidateQueries({ queryKey: ["demanda", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reenviar.");
    } finally {
      setReenviando(false);
    }
  }

  async function reprocessarAgora() {
    if (!aprovacao) return;
    setReprocessando(true);
    try {
      const r = await reprocessar({ data: { aprovacao_id: aprovacao.id } });
      if (r.retomado) toast.success("Retomada reprocessada.");
      else toast.warning("O n8n não confirmou a retomada.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["demanda", id] }),
        qc.invalidateQueries({ queryKey: ["demanda-eventos", id] }),
        qc.invalidateQueries({ queryKey: ["demanda-pagamento", id] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reprocessar retomada.");
    } finally {
      setReprocessando(false);
    }
  }

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!demanda) return <div className="p-6 text-sm text-muted-foreground">Demanda não encontrada. <Link to="/demandas" search={{ status: "", rota: "", q: "" }} className="underline">Voltar</Link></div>;

  const st = statusInfo(demanda.status);
  const podeReprocessar = gestor && demanda.status === "aprovada" && !pagamento && aprovacao?.status === "aprovada"
    && eventos.some((ev) => ev.mensagem === "Decisão gravada, mas o n8n não confirmou a retomada");
  const confiancaPct = demanda.confianca != null ? Math.round(demanda.confianca * 100) : null;
  const extracao = (demanda.extracao && typeof demanda.extracao === "object" ? demanda.extracao : {}) as Record<string, unknown>;

  return (
    <div>
      <div className="border-b bg-card px-6 py-5">
        <Link to="/demandas" search={{ status: "", rota: "", q: "" }} className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline">
          <ArrowLeft className="h-3 w-3" /> Demandas
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-xl font-semibold tracking-tight">{demanda.codigo}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.classe}`}>{st.rotulo}</span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{rotaRotulo(demanda.rota)}</span>
          {demanda.status === "erro" && gestor && (
            <Button size="sm" variant="outline" className="ml-auto" disabled={reenviando} onClick={reenviarAgora}>
              <RotateCcw /> {reenviando ? "Reenviando…" : "Reenviar ao orquestrador"}
            </Button>
          )}
          {podeReprocessar && (
            <Button size="sm" variant="outline" disabled={reprocessando} onClick={reprocessarAgora}>
              <RotateCcw /> {reprocessando ? "Reprocessando…" : "Reprocessar retomada"}
            </Button>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {demanda.fornecedor_nome || "Fornecedor não identificado"} · {brl(demanda.valor)} · criada em {dataHoraBR(demanda.criado_em)} via {demanda.canal}
        </p>
      </div>

      <div className="grid gap-4 p-6 lg:grid-cols-2">
        <Card titulo="Dados extraídos pela IA">
          <div className="grid grid-cols-2 gap-4">
            <Campo rotulo="Fornecedor" valor={demanda.fornecedor_nome} />
            <Campo rotulo="CNPJ" valor={demanda.cnpj} />
            <Campo rotulo="Valor" valor={<span className="num">{brl(demanda.valor)}</span>} />
            <Campo rotulo="Vencimento" valor={<span className="num">{dataBR(demanda.vencimento)}</span>} />
            <Campo rotulo="Nº do documento" valor={demanda.numero_documento} />
            <Campo rotulo="Tipo de documento" valor={demanda.tipo_documento} />
            <Campo rotulo="Categoria" valor={demanda.categoria} />
            <Campo rotulo="Prioridade" valor={demanda.prioridade} />
          </div>
          {demanda.descricao && <p className="mt-3 text-sm text-muted-foreground">{demanda.descricao}</p>}
          {Object.keys(extracao).length > 0 && (
            <pre className="mt-3 max-h-48 overflow-auto rounded bg-muted p-3 font-mono text-xs">{JSON.stringify(extracao, null, 2)}</pre>
          )}
          {confiancaPct != null && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Confiança da extração</span><span className="num">{confiancaPct}%</span>
              </div>
              <Progress value={confiancaPct} />
            </div>
          )}
          {demanda.recomendacao_ia && (
            <div className="mt-4 rounded border border-primary/30 bg-accent/50 p-3 text-sm">
              <div className="mb-1 flex items-center gap-1 text-xs font-medium text-primary">
                <Sparkles className="h-3 w-3" /> Sugestão da IA — não é decisão
              </div>
              {demanda.recomendacao_ia}
            </div>
          )}
        </Card>

        <Card titulo="Checagens da regra de alçada">
          <ul className="space-y-2">
            {CHECAGENS.map((c) => {
              const { ok, detalhe } = valorChecagem(demanda.checagens, c.chave);
              return (
                <li key={c.chave} className="flex items-start gap-2 text-sm">
                  {ok === true ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    : ok === false ? <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    : <span className="mt-0.5 w-4 text-center text-muted-foreground">·</span>}
                  <span>
                    {c.rotulo}
                    {detalhe && <span className="ml-1 text-xs text-muted-foreground">({detalhe})</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          {demanda.motivos.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <div className="text-xs font-medium text-muted-foreground">Motivos</div>
              <ul className="mt-1 list-disc pl-5 text-sm">{demanda.motivos.map((m) => <li key={m}>{m}</li>)}</ul>
            </div>
          )}
        </Card>

        <Card titulo="Aprovação humana">
          {aprovacao ? (
            <div className="grid grid-cols-2 gap-4">
              <Campo rotulo="Situação" valor={aprovacao.status} />
              <Campo rotulo="Prazo" valor={<span className="num">{dataHoraBR(aprovacao.prazo)}</span>} />
              <Campo rotulo="Decidido por" valor={aprovacao.decidido_por_nome} />
              <Campo rotulo="Decidido em" valor={<span className="num">{dataHoraBR(aprovacao.decidido_em)}</span>} />
              {aprovacao.justificativa && (
                <div className="col-span-2"><Campo rotulo="Justificativa" valor={aprovacao.justificativa} /></div>
              )}
              {aprovacao.motivo && (
                <div className="col-span-2"><Campo rotulo="Motivo do envio para aprovação" valor={aprovacao.motivo} /></div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Esta demanda não passou por aprovação humana.</p>
          )}
        </Card>

        <Card titulo="Pagamento">
          {pagamento ? (
            <div className="grid grid-cols-2 gap-4">
              <Campo rotulo="Valor" valor={<span className="num">{brl(pagamento.valor)}</span>} />
              <Campo rotulo="Data agendada" valor={<span className="num">{dataBR(pagamento.data_agendada)}</span>} />
              <Campo rotulo="Situação" valor={pagamento.status} />
              <Campo rotulo="Registrado em" valor={<span className="num">{dataHoraBR(pagamento.criado_em)}</span>} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum pagamento agendado para esta demanda.</p>
          )}
        </Card>

        <div className="lg:col-span-2">
          <Card titulo={`Linha do tempo (${eventos.length})`}>
            {eventos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
            ) : (
              <ol className="relative space-y-4 border-l pl-6">
                {eventos.map((ev) => {
                  const Icone = ORIGEM_ICONE[ev.origem] ?? AppWindow;
                  const cor = TIPO_COR[ev.tipo] ?? "text-muted-foreground";
                  return (
                    <li key={ev.id} className="relative">
                      <span className={`absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border bg-card ${cor}`}>
                        <Icone className="h-3 w-3" />
                      </span>
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-medium">{ev.mensagem || ev.etapa || ev.tipo}</span>
                        <span className="text-xs text-muted-foreground">{ev.origem}{ev.etapa ? ` · ${ev.etapa}` : ""}</span>
                      </div>
                      <div className="text-xs tabular-nums text-muted-foreground">
                        {dataHoraBR(ev.criado_em)}
                        {ev.execution_id && <span className="ml-2 font-mono">n8n exec {ev.execution_id}</span>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Collapsible open={textoAberto} onOpenChange={setTextoAberto}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                Texto original recebido
                {textoAberto ? <ChevronDown /> : <ChevronRight />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md border bg-card p-4 font-mono text-xs">
                {demanda.texto_original}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
