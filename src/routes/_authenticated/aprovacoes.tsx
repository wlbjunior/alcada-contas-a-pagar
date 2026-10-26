import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { valorChecagem } from "@/lib/format";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { decidirAprovacao } from "@/lib/fluxo.functions";

export const Route = createFileRoute("/_authenticated/aprovacoes")({
  head: () => ({
    meta: [
      { title: "Aprovações — Alçada" },
      { name: "description", content: "Decisões humanas pendentes conforme as regras de alçada." },
      { property: "og:title", content: "Aprovações — Alçada" },
      { property: "og:description", content: "Decisões humanas pendentes conforme as regras de alçada." },
    ],
  }),
  component: Aprovacoes,
});

const brl = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const dataBR = (s: string | null) =>
  s ? new Date(s.length === 10 ? `${s}T12:00:00` : s).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" }) : "—";
const dataHoraBR = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }) : "—";

const CHECAGENS_RESUMO: [string, string][] = [
  ["receita_consultada", "Receita"], ["fornecedor_cadastrado", "Cadastro"], ["fornecedor_homologado", "Homologado"],
  ["sem_duplicidade", "Duplicidade"], ["orcamento_ok", "Orçamento"], ["dentro_do_limite", "Alçada"],
];

function prazoRestante(prazo: string | null, agora: number) {
  if (!prazo) return "sem prazo";
  const ms = new Date(prazo).getTime() - agora;
  if (ms <= 0) return "expirado";
  const h = Math.floor(ms / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}min`;
}

type Linha = {
  id: string; status: string; prazo: string | null; motivo: string | null; recomendacao_ia: string | null;
  justificativa: string | null; decidido_por_nome: string | null; decidido_em: string | null; criado_em: string;
  demandas: {
    id: string; codigo: string; fornecedor_nome: string | null; valor: number | null; vencimento: string | null;
    motivos: string[]; recomendacao_ia: string | null; checagens: unknown; criado_por: string | null;
  } | null;
};

function Aprovacoes() {
  const qc = useQueryClient();
  const [agora, setAgora] = useState(() => Date.now());
  const [dialogo, setDialogo] = useState<{ ap: Linha; decisao: "aprovar" | "rejeitar" } | null>(null);
  const [just, setJust] = useState("");
  const [salvando, setSalvando] = useState(false);
  const decidir = useServerFn(decidirAprovacao);

  const { data: usuario } = useQuery({
    queryKey: ["eu-gestor"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id ?? "";
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", id);
      return { id, gestor: (r ?? []).some((x) => x.role === "gestor" || x.role === "admin") };
    },
  });

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ["aprovacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aprovacoes")
        .select("id, status, prazo, motivo, recomendacao_ia, justificativa, decidido_por_nome, decidido_em, criado_em, demandas(id, codigo, fornecedor_nome, valor, vencimento, motivos, recomendacao_ia, checagens, criado_por)")
        .order("criado_em", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as Linha[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("aprovacoes-tela")
      .on("postgres_changes", { event: "*", schema: "public", table: "aprovacoes" }, () => qc.invalidateQueries({ queryKey: ["aprovacoes"] }))
      .subscribe();
    const t = setInterval(() => setAgora(Date.now()), 30000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [qc]);

  const pendentes = lista.filter((a) => a.status === "pendente" && !(a.prazo && new Date(a.prazo).getTime() < agora));
  const historico = lista.filter((a) => !pendentes.includes(a));

  async function confirmar() {
    if (!dialogo) return;
    if (dialogo.decisao === "rejeitar" && just.trim().length < 10) {
      toast.error("Justificativa obrigatória (mín. 10 caracteres) ao rejeitar.");
      return;
    }
    setSalvando(true);
    try {
      const r = await decidir({ data: { aprovacao_id: dialogo.ap.id, decisao: dialogo.decisao, justificativa: just.trim() } });
      if (r.retomado) toast.success(`Demanda ${dialogo.ap.demandas?.codigo} ${r.status}.`);
      else toast.warning("Decisão gravada, mas o n8n não confirmou a retomada.");
      setDialogo(null);
      qc.invalidateQueries({ queryKey: ["aprovacoes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao decidir.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <PageHeader title="Aprovações" description="Decisões humanas pendentes conforme as regras de alçada." />
      <div className="space-y-8 p-6">
        {usuario && !usuario.gestor && (
          <div className="rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">
            Seu papel é analista: você pode acompanhar as aprovações, mas só gestores e admins decidem pagamentos.
          </div>
        )}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pendentes ({pendentes.length})</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : pendentes.length === 0 ? (
            <div className="rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">Nenhuma aprovação pendente.</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {pendentes.map((a) => {
                const d = a.demandas;
                const motivos = d?.motivos?.length ? d.motivos : a.motivo ? [a.motivo] : [];
                const rec = a.recomendacao_ia || d?.recomendacao_ia;
                const autor = d?.criado_por && d.criado_por === usuario?.id;
                const bloqueio = !usuario?.gestor ? "Só gestores decidem pagamentos" : autor ? "Quem lançou a demanda não pode aprová-la" : null;
                return (
                  <div key={a.id} className="space-y-3 rounded-md border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-xs text-muted-foreground">{d?.codigo}</div>
                        <div className="font-medium">{d?.fornecedor_nome || "Fornecedor não identificado"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold tabular-nums">{brl(d?.valor ?? null)}</div>
                        <div className="text-xs text-muted-foreground">vence {dataBR(d?.vencimento ?? null)}</div>
                      </div>
                    </div>
                    {motivos.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">Motivos da regra</div>
                        <ul className="mt-1 list-disc pl-5 text-sm">{motivos.map((m) => <li key={m}>{m}</li>)}</ul>
                      </div>
                    )}
                    {rec && (
                      <div className="rounded border border-primary/30 bg-accent/50 p-3 text-sm">
                        <div className="mb-1 flex items-center gap-1 text-xs font-medium text-primary">
                          <Sparkles className="h-3 w-3" /> Sugestão da IA — não é decisão
                        </div>
                        {rec}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {CHECAGENS_RESUMO.map(([k, rot]) => {
                        const { ok } = valorChecagem(d?.checagens, k);
                        return (
                          <Badge key={k} variant={ok === false ? "destructive" : "secondary"} className="gap-1 font-normal">
                            {ok === true ? <Check className="h-3 w-3" /> : ok === false ? <X className="h-3 w-3" /> : "·"} {rot}
                          </Badge>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t pt-3">
                      <span className="text-xs tabular-nums text-muted-foreground">Prazo: {prazoRestante(a.prazo, agora)}</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={!!bloqueio} onClick={() => { setJust(""); setDialogo({ ap: a, decisao: "rejeitar" }); }}>Rejeitar</Button>
                        <Button size="sm" disabled={!!bloqueio} onClick={() => { setJust(""); setDialogo({ ap: a, decisao: "aprovar" }); }}>Aprovar</Button>
                      </div>
                    </div>
                    {bloqueio && <p className="text-right text-xs text-muted-foreground">{bloqueio}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Histórico</h2>
          <div className="overflow-x-auto rounded-md border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr><th className="px-3 py-2">Código</th><th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2">Decidido por</th><th className="px-3 py-2">Quando</th><th className="px-3 py-2">Justificativa</th></tr>
              </thead>
              <tbody>
                {historico.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Sem histórico.</td></tr>
                ) : historico.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{a.demandas?.codigo}</td>
                    <td className="px-3 py-2">{a.demandas?.fornecedor_nome || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(a.demandas?.valor ?? null)}</td>
                    <td className="px-3 py-2"><Badge variant={a.status === "rejeitada" ? "destructive" : "secondary"}>{a.status === "pendente" ? "expirada" : a.status}</Badge></td>
                    <td className="px-3 py-2">{a.decidido_por_nome || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{dataHoraBR(a.decidido_em ?? a.prazo)}</td>
                    <td className="max-w-xs truncate px-3 py-2 text-muted-foreground">{a.justificativa || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Dialog open={!!dialogo} onOpenChange={(o) => !o && setDialogo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogo?.decisao === "aprovar" ? "Aprovar pagamento" : "Rejeitar pagamento"}</DialogTitle>
            <DialogDescription>{dialogo?.ap.demandas?.codigo} · {dialogo?.ap.demandas?.fornecedor_nome} · {brl(dialogo?.ap.demandas?.valor ?? null)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="just">Justificativa {dialogo?.decisao === "rejeitar" ? "(obrigatória, mín. 10 caracteres)" : "(opcional)"}</Label>
            <Textarea id="just" rows={4} maxLength={2000} value={just} onChange={(e) => setJust(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogo(null)}>Cancelar</Button>
            <Button variant={dialogo?.decisao === "rejeitar" ? "destructive" : "default"} disabled={salvando} onClick={confirmar}>
              {salvando ? "Gravando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
