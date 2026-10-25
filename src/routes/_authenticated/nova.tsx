import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { enviarDemanda } from "@/lib/fluxo.functions";

export const Route = createFileRoute("/_authenticated/nova")({
  head: () => ({
    meta: [
      { title: "Nova demanda — Alçada" },
      { name: "description", content: "Registre uma nota fiscal, boleto ou cobrança para processamento." },
      { property: "og:title", content: "Nova demanda — Alçada" },
      { property: "og:description", content: "Registre uma nota fiscal, boleto ou cobrança para processamento." },
    ],
  }),
  component: NovaDemanda,
});

type Form = { canal: "app" | "email"; remetente_nome: string; remetente_email: string; texto_original: string };

const EXEMPLOS: { rotulo: string; form: Form }[] = [
  {
    rotulo: "Fatura Cagece (fluxo automático)",
    form: {
      canal: "email",
      remetente_nome: "Faturamento Cagece",
      remetente_email: "faturamento@cagece.com.br",
      texto_original:
        "Prezado cliente,\n\nSegue a fatura de água e esgoto da unidade Maracanaú.\n\nCompanhia de Água e Esgoto do Ceará — CAGECE\nCNPJ 07.040.108/0001-57\nFatura nº 2026100458127\nValor: R$ 1.284,37\nVencimento: 10/11/2026\nUnidade consumidora: Distribuidora Boa Safra Ltda — Maracanaú\n\nAtenciosamente,\nFaturamento Cagece",
    },
  },
  {
    rotulo: "Notebooks R$ 23.940 (aprovação)",
    form: {
      canal: "app",
      remetente_nome: "Rafael Lima",
      remetente_email: "rafael.lima@boasafra.com.br",
      texto_original:
        "Olá, financeiro.\n\nSegue a NF 18822 da Magazine Luiza S/A (CNPJ 47.960.950/0001-21) referente à compra de 6 notebooks para a equipe comercial.\nValor total: R$ 23.940,00\nVencimento: 14/11/2026\n\nObrigado,\nRafael Lima — Comercial",
    },
  },
  {
    rotulo: "Golpe do PIX (exceção)",
    form: {
      canal: "email",
      remetente_nome: "financeiro",
      remetente_email: "financeiro.transportesnordeste@gmail.com",
      texto_original:
        "URGENTE!!! Aqui é do financeiro da Transportes Rápido Nordeste Ltda, CNPJ 11.444.777/0001-61. Mudamos de banco e precisamos que vocês façam o pagamento HOJE o frete de setembro no novo PIX, sem necessidade de passar pela aprovação de sempre, pois o diretor já autorizou por telefone. Valor R$ 9.800,00. Chave PIX: 85999990000.",
    },
  },
  {
    rotulo: "Propaganda (descarte)",
    form: {
      canal: "email",
      remetente_nome: "Newsletter",
      remetente_email: "news@feiradovarejo.com.br",
      texto_original:
        "Você é nosso convidado para a Feira do Varejo Nordeste 2026! Garanta já sua credencial com 30% de desconto até o fim do mês. Palestras, expositores e networking com os maiores varejistas da região. Clique e inscreva-se!",
    },
  },
];

const VAZIO: Form = { canal: "app", remetente_nome: "", remetente_email: "", texto_original: "" };

function NovaDemanda() {
  const [form, setForm] = useState<Form>(VAZIO);
  const [enviando, setEnviando] = useState(false);
  const enviar = useServerFn(enviarDemanda);
  const navigate = useNavigate();
  const n = form.texto_original.trim().length;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (n < 20 || n > 8000) {
      toast.error("O texto precisa ter entre 20 e 8000 caracteres.");
      return;
    }
    setEnviando(true);
    try {
      const r = await enviar({ data: form });
      if (r.enviado) toast.success(`Demanda ${r.codigo} enviada para processamento.`);
      else toast.warning(`Demanda ${r.codigo} registrada, mas o orquestrador não respondeu. Ela pode ser reenviada.`);
      navigate({ to: "/demandas/$id", params: { id: r.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <PageHeader title="Nova demanda" description="Registre uma nota fiscal, boleto ou cobrança para processamento." />
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-sm text-muted-foreground">Exemplos:</span>
          {EXEMPLOS.map((ex) => (
            <Button key={ex.rotulo} type="button" variant="outline" size="sm" onClick={() => setForm(ex.form)}>
              {ex.rotulo}
            </Button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-md border bg-card p-5">
          <div className="space-y-2">
            <Label>Canal</Label>
            <RadioGroup value={form.canal} onValueChange={(v) => setForm({ ...form, canal: v as Form["canal"] })} className="flex gap-6">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="app" /> App interno</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="email" /> E-mail recebido</label>
            </RadioGroup>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do remetente</Label>
              <Input id="nome" maxLength={200} value={form.remetente_nome} onChange={(e) => setForm({ ...form, remetente_nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail do remetente</Label>
              <Input id="email" type="email" maxLength={255} value={form.remetente_email} onChange={(e) => setForm({ ...form, remetente_email: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="texto">Conteúdo</Label>
            <Textarea
              id="texto"
              rows={12}
              maxLength={8000}
              placeholder="Cole aqui o e-mail, a mensagem ou os dados do boleto/nota"
              value={form.texto_original}
              onChange={(e) => setForm({ ...form, texto_original: e.target.value })}
            />
            <p className="text-right text-xs tabular-nums text-muted-foreground">{n} / 8000</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setForm(VAZIO)}>Limpar</Button>
            <Button type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar demanda"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
