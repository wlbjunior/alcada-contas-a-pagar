import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { salvarCentroCusto, excluirCentroCusto } from "@/lib/painel.functions";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/centros-custo")({
  head: () => ({
    meta: [
      { title: "Centros de custo — Alçada" },
      { name: "description", content: "Centros de custo e orçamento mensal disponível." },
      { property: "og:title", content: "Centros de custo — Alçada" },
      { property: "og:description", content: "Centros de custo e orçamento mensal disponível." },
    ],
  }),
  component: CentrosCusto,
});

type Centro = { id: string; codigo: string; nome: string; orcamento_mensal: number };

const inicioMes = () => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit" }).format(new Date());
  return new Date(`${p}-01T00:00:00-03:00`).toISOString();
};

function CentrosCusto() {
  const qc = useQueryClient();
  const salvar = useServerFn(salvarCentroCusto);
  const excluir = useServerFn(excluirCentroCusto);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Centro | null>(null);
  const [form, setForm] = useState({ codigo: "", nome: "", orcamento: "" });
  const [salvando, setSalvando] = useState(false);

  const { data: papeis = [] } = useQuery({
    queryKey: ["meus-papeis-cc"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user?.id ?? "");
      return (r ?? []).map((x) => x.role);
    },
  });
  const gestor = papeis.some((r) => r === "gestor" || r === "admin");

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ["centros-custo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("centros_custo").select("*").order("codigo");
      if (error) throw error;
      return data as Centro[];
    },
  });

  // Comprometido no mês: soma das demandas do mês por centro de custo
  const { data: comprometido = {} } = useQuery({
    queryKey: ["comprometido-mes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandas")
        .select("centro_custo_id, valor")
        .gte("criado_em", inicioMes())
        .not("centro_custo_id", "is", null)
        .not("status", "in", '("rejeitada","descartada","erro")');
      if (error) throw error;
      const mapa: Record<string, number> = {};
      for (const d of data ?? []) {
        if (d.centro_custo_id) mapa[d.centro_custo_id] = (mapa[d.centro_custo_id] ?? 0) + (d.valor ?? 0);
      }
      return mapa;
    },
  });

  function abrir(c?: Centro) {
    setEditando(c ?? null);
    setForm(c ? { codigo: c.codigo, nome: c.nome, orcamento: String(c.orcamento_mensal).replace(".", ",") } : { codigo: "", nome: "", orcamento: "" });
    setAberto(true);
  }

  async function gravar() {
    const orcamento = Number(form.orcamento.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(orcamento) || orcamento < 0) {
      toast.error("Orçamento inválido.");
      return;
    }
    setSalvando(true);
    try {
      await salvar({ data: { id: editando?.id, codigo: form.codigo, nome: form.nome, orcamento_mensal: orcamento } });
      toast.success(editando ? "Centro de custo atualizado." : "Centro de custo cadastrado.");
      setAberto(false);
      qc.invalidateQueries({ queryKey: ["centros-custo"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(c: Centro) {
    if (!window.confirm(`Excluir ${c.nome}?`)) return;
    try {
      await excluir({ data: { id: c.id } });
      toast.success("Centro de custo excluído.");
      qc.invalidateQueries({ queryKey: ["centros-custo"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  }

  return (
    <div>
      <PageHeader title="Centros de custo" description="Centros de custo e orçamento mensal disponível." />
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {gestor ? "Gestores podem cadastrar e editar." : "Você está em modo leitura (apenas gestores editam)."}
          </p>
          {gestor && <Button size="sm" onClick={() => abrir()}><Plus /> Novo centro</Button>}
        </div>

        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2 text-right">Orçamento mensal</th>
                <th className="px-3 py-2 text-right">Comprometido no mês</th>
                <th className="px-3 py-2 text-right">Disponível</th>
                {gestor && <th className="px-3 py-2 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Carregando…</td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Nenhum centro de custo cadastrado.</td></tr>
              ) : lista.map((c) => {
                const comp = comprometido[c.id] ?? 0;
                const disp = c.orcamento_mensal - comp;
                return (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{c.codigo}</td>
                    <td className="px-3 py-2 font-medium">{c.nome}</td>
                    <td className="px-3 py-2 text-right num">{brl(c.orcamento_mensal)}</td>
                    <td className="px-3 py-2 text-right num">{brl(comp)}</td>
                    <td className={`px-3 py-2 text-right num ${disp < 0 ? "text-destructive" : ""}`}>{brl(disp)}</td>
                    {gestor && (
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="icon-sm" onClick={() => abrir(c)} aria-label="Editar"><Pencil /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => remover(c)} aria-label="Excluir"><Trash2 /></Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar centro de custo" : "Novo centro de custo"}</DialogTitle>
            <DialogDescription>O orçamento mensal limita a aprovação automática por centro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cod">Código</Label>
              <Input id="cod" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="CC-01" />
            </div>
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="orc">Orçamento mensal (R$)</Label>
              <Input id="orc" inputMode="decimal" value={form.orcamento} onChange={(e) => setForm({ ...form, orcamento: e.target.value })} placeholder="15000,00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button disabled={salvando || !form.codigo.trim() || !form.nome.trim() || !form.orcamento.trim()} onClick={gravar}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
