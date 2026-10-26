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
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { salvarFornecedor, excluirFornecedor } from "@/lib/painel.functions";
import { mascararCnpj, cnpjValido } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores — Alçada" },
      { name: "description", content: "Cadastro e homologação de fornecedores." },
      { property: "og:title", content: "Fornecedores — Alçada" },
      { property: "og:description", content: "Cadastro e homologação de fornecedores." },
    ],
  }),
  component: Fornecedores,
});

type Fornecedor = { id: string; razao_social: string; cnpj: string; homologado: boolean; categoria_padrao: string | null };

const vazio = { razao_social: "", cnpj: "", homologado: false, categoria_padrao: "" };

function Fornecedores() {
  const qc = useQueryClient();
  const salvar = useServerFn(salvarFornecedor);
  const excluir = useServerFn(excluirFornecedor);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState(vazio);
  const [salvando, setSalvando] = useState(false);

  const { data: papeis = [] } = useQuery({
    queryKey: ["meus-papeis-forn"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user?.id ?? "");
      return (r ?? []).map((x) => x.role);
    },
  });
  const gestor = papeis.some((r) => r === "gestor" || r === "admin");

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("*").order("razao_social");
      if (error) throw error;
      return data as Fornecedor[];
    },
  });

  const cnpjOk = form.cnpj.replace(/\D/g, "").length === 14 && cnpjValido(form.cnpj);

  function abrir(f?: Fornecedor) {
    setEditando(f ?? null);
    setForm(f ? { razao_social: f.razao_social, cnpj: mascararCnpj(f.cnpj), homologado: f.homologado, categoria_padrao: f.categoria_padrao ?? "" } : vazio);
    setAberto(true);
  }

  async function gravar() {
    setSalvando(true);
    try {
      await salvar({ data: { id: editando?.id, ...form } });
      toast.success(editando ? "Fornecedor atualizado." : "Fornecedor cadastrado.");
      setAberto(false);
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(f: Fornecedor) {
    if (!window.confirm(`Excluir ${f.razao_social}?`)) return;
    try {
      await excluir({ data: { id: f.id } });
      toast.success("Fornecedor excluído.");
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  }

  return (
    <div>
      <PageHeader title="Fornecedores" description="Cadastro e homologação de fornecedores." />
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {gestor ? "Gestores podem cadastrar, editar e homologar." : "Você está em modo leitura (apenas gestores editam)."}
          </p>
          {gestor && <Button size="sm" onClick={() => abrir()}><Plus /> Novo fornecedor</Button>}
        </div>

        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Razão social</th>
                <th className="px-3 py-2">CNPJ</th>
                <th className="px-3 py-2">Categoria padrão</th>
                <th className="px-3 py-2">Homologado</th>
                {gestor && <th className="px-3 py-2 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Carregando…</td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nenhum fornecedor cadastrado.</td></tr>
              ) : lista.map((f) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{f.razao_social}</td>
                  <td className="px-3 py-2 font-mono text-xs">{mascararCnpj(f.cnpj)}</td>
                  <td className="px-3 py-2">{f.categoria_padrao || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.homologado ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {f.homologado ? "Sim" : "Não"}
                    </span>
                  </td>
                  {gestor && (
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon-sm" onClick={() => abrir(f)} aria-label="Editar"><Pencil /></Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => remover(f)} aria-label="Excluir"><Trash2 /></Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
            <DialogDescription>O CNPJ é validado pelos dígitos verificadores.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="razao">Razão social</Label>
              <Input id="razao" value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: mascararCnpj(e.target.value) })}
                placeholder="00.000.000/0000-00"
              />
              {form.cnpj.replace(/\D/g, "").length === 14 && !cnpjOk && (
                <p className="mt-1 text-xs text-destructive">CNPJ inválido (dígitos verificadores não conferem).</p>
              )}
            </div>
            <div>
              <Label htmlFor="cat">Categoria padrão</Label>
              <Input id="cat" value={form.categoria_padrao} onChange={(e) => setForm({ ...form, categoria_padrao: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="hom" checked={form.homologado} onCheckedChange={(v) => setForm({ ...form, homologado: v })} />
              <Label htmlFor="hom">Homologado</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button disabled={salvando || !form.razao_social.trim() || !cnpjOk} onClick={gravar}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
