import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { salvarConfiguracao, statusIntegracao, listarUsuarios, alterarPapel } from "@/lib/painel.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Alçada" },
      { name: "description", content: "Limites de alçada, confiança mínima e prazos do fluxo." },
      { property: "og:title", content: "Configurações — Alçada" },
      { property: "og:description", content: "Limites de alçada, confiança mínima e prazos do fluxo." },
    ],
  }),
  component: Configuracoes,
});

const CONFIGS: { chave: string; rotulo: string; explicacao: string; passo: string }[] = [
  {
    chave: "limite_aprovacao_automatica",
    rotulo: "Limite de aprovação automática (R$)",
    explicacao: "Demandas com valor até este limite seguem sem aprovação humana, se passarem em todas as checagens.",
    passo: "100",
  },
  {
    chave: "confianca_minima",
    rotulo: "Confiança mínima da IA (0 a 1)",
    explicacao: "Abaixo desta confiança na extração, a demanda vai para revisão humana mesmo que os dados pareçam completos.",
    passo: "0.05",
  },
  {
    chave: "prazo_aprovacao_horas",
    rotulo: "Prazo de aprovação (horas)",
    explicacao: "Tempo que o gestor tem para decidir. Vencido o prazo, a aprovação expira e a demanda é escalada.",
    passo: "1",
  },
  {
    chave: "janela_duplicidade_dias",
    rotulo: "Janela de duplicidade (dias)",
    explicacao: "Documentos do mesmo fornecedor com mesmo número dentro desta janela são tratados como duplicidade.",
    passo: "1",
  },
];

function Configuracoes() {
  const qc = useQueryClient();
  const salvarCfg = useServerFn(salvarConfiguracao);
  const mudarPapel = useServerFn(alterarPapel);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  const { data: papeis = [] } = useQuery({
    queryKey: ["meus-papeis-cfg"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user?.id ?? "");
      return (r ?? []).map((x) => x.role);
    },
  });
  const gestor = papeis.some((r) => r === "gestor" || r === "admin");
  const admin = papeis.includes("admin");

  const { data: configuracoes = [] } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes").select("chave, valor, descricao");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const mapa: Record<string, string> = {};
    for (const c of configuracoes) mapa[c.chave] = String(typeof c.valor === "number" ? c.valor : JSON.stringify(c.valor));
    setValores(mapa);
  }, [configuracoes]);

  const { data: integracao } = useQuery({
    queryKey: ["status-integracao"],
    queryFn: () => statusIntegracao(),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios-papeis"],
    queryFn: () => listarUsuarios(),
    enabled: admin,
  });

  async function salvar(chave: string) {
    const v = Number((valores[chave] ?? "").replace(",", "."));
    if (!Number.isFinite(v) || v < 0) {
      toast.error("Valor inválido.");
      return;
    }
    setSalvando(chave);
    try {
      await salvarCfg({ data: { chave: chave as never, valor: v } });
      toast.success("Configuração salva.");
      qc.invalidateQueries({ queryKey: ["configuracoes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(null);
    }
  }

  async function trocarPapel(userId: string, role: string) {
    try {
      await mudarPapel({ data: { user_id: userId, role: role as "analista" | "gestor" | "admin" } });
      toast.success("Papel atualizado.");
      qc.invalidateQueries({ queryKey: ["usuarios-papeis"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao alterar papel.");
    }
  }

  return (
    <div>
      <PageHeader title="Configurações" description="Limites de alçada, confiança mínima e prazos do fluxo." />
      <div className="grid gap-4 p-6 lg:grid-cols-2">
        <section className="rounded-md border bg-card">
          <h2 className="border-b px-4 py-2.5 text-sm font-semibold">Parâmetros do fluxo</h2>
          <div className="space-y-5 p-4">
            {!gestor && <p className="text-sm text-muted-foreground">Você está em modo leitura (apenas gestores editam).</p>}
            {CONFIGS.map((c) => (
              <div key={c.chave} className="space-y-1">
                <Label htmlFor={c.chave}>{c.rotulo}</Label>
                <div className="flex gap-2">
                  <Input
                    id={c.chave}
                    inputMode="decimal"
                    step={c.passo}
                    disabled={!gestor}
                    value={valores[c.chave] ?? ""}
                    onChange={(e) => setValores({ ...valores, [c.chave]: e.target.value })}
                  />
                  {gestor && (
                    <Button size="sm" variant="outline" disabled={salvando === c.chave} onClick={() => salvar(c.chave)}>
                      {salvando === c.chave ? "…" : "Salvar"}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{c.explicacao}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-md border bg-card">
            <h2 className="border-b px-4 py-2.5 text-sm font-semibold">Integração com o n8n</h2>
            <div className="p-4">
              {!integracao ? (
                <p className="text-sm text-muted-foreground">Verificando…</p>
              ) : integracao.configurada ? (
                <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-success" /> Configurada — o painel consegue chamar o orquestrador.</p>
              ) : (
                <p className="flex items-center gap-2 text-sm"><XCircle className="h-4 w-4 text-destructive" /> Não configurada — faltam segredos de integração no banco.</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Os valores dos segredos nunca são exibidos aqui.</p>
            </div>
          </section>

          <section className="rounded-md border bg-card">
            <h2 className="border-b px-4 py-2.5 text-sm font-semibold">Papéis</h2>
            <div className="p-4">
              {!admin ? (
                <p className="text-sm text-muted-foreground">Apenas administradores gerenciam papéis.</p>
              ) : usuarios.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
              ) : (
                <ul className="space-y-3">
                  {usuarios.map((u) => (
                    <li key={u.id} className="flex items-center gap-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{u.nome || u.email || u.id}</div>
                        {u.nome && <div className="truncate text-xs text-muted-foreground">{u.email}</div>}
                      </div>
                      <Select value={u.papeis[0] ?? "analista"} onValueChange={(v) => trocarPapel(u.id, v)}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="analista">Analista</SelectItem>
                          <SelectItem value="gestor">Gestor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
