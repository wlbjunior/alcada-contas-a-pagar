export const brl = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dataBR = (s: string | null | undefined) =>
  s ? new Date(s.length === 10 ? `${s}T12:00:00` : s).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" }) : "—";

export const dataHoraBR = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }) : "—";

export const STATUS: Record<string, { rotulo: string; classe: string }> = {
  recebida: { rotulo: "Recebida", classe: "bg-muted text-muted-foreground" },
  em_analise: { rotulo: "Em análise", classe: "bg-chart-1/15 text-chart-1" },
  aguardando_aprovacao: { rotulo: "Aguardando aprovação", classe: "bg-warning/20 text-warning" },
  aprovada_auto: { rotulo: "Aprovada (auto)", classe: "bg-success/15 text-success" },
  aprovada: { rotulo: "Aprovada", classe: "bg-success/15 text-success" },
  rejeitada: { rotulo: "Rejeitada", classe: "bg-destructive/15 text-destructive" },
  agendada: { rotulo: "Agendada", classe: "bg-success/15 text-success" },
  escalada: { rotulo: "Escalada", classe: "bg-warning/20 text-warning" },
  descartada: { rotulo: "Descartada", classe: "bg-muted text-muted-foreground" },
  erro: { rotulo: "Erro", classe: "bg-destructive/15 text-destructive" },
};

export const statusInfo = (s: string) => STATUS[s] ?? { rotulo: s, classe: "bg-muted text-muted-foreground" };

export const ROTAS: Record<string, string> = {
  automatica: "Automática",
  aprovacao: "Aprovação",
  excecao: "Exceção",
  descarte: "Descarte",
};

export const rotaRotulo = (r: string | null | undefined) => (r ? (ROTAS[r] ?? r) : "—");

// Checagens do jsonb `checagens`: cada valor pode ser booleano ou { ok, ...detalhes }
export type Checagem = { chave: string; rotulo: string; detalhe?: (v: Record<string, unknown>) => string | null };

const txt = (v: Record<string, unknown>, ...ks: string[]) => {
  for (const k of ks) {
    const x = v[k];
    if (typeof x === "string" && x) return x;
    if (typeof x === "number") return String(x);
  }
  return null;
};

export const CHECAGENS: Checagem[] = [
  { chave: "ia", rotulo: "IA respondeu" },
  { chave: "obrigatorios", rotulo: "Campos obrigatórios" },
  { chave: "confianca", rotulo: "Confiança mínima", detalhe: (v) => txt(v, "confianca", "valor") },
  { chave: "cnpj_valido", rotulo: "CNPJ válido" },
  { chave: "receita", rotulo: "Consulta à Receita Federal", detalhe: (v) => txt(v, "razao_social", "razao_social_oficial") },
  { chave: "cnpj_ativo", rotulo: "CNPJ ativo", detalhe: (v) => txt(v, "situacao") },
  { chave: "nome_confere", rotulo: "Nome confere com a Receita" },
  { chave: "cadastro", rotulo: "Fornecedor cadastrado" },
  { chave: "homologado", rotulo: "Homologado" },
  {
    chave: "duplicidade",
    rotulo: "Sem duplicidade",
    detalhe: (v) => {
      const c = v["codigos"];
      return Array.isArray(c) && c.length ? `códigos: ${c.join(", ")}` : txt(v, "codigo");
    },
  },
  { chave: "alcada", rotulo: "Dentro da alçada", detalhe: (v) => txt(v, "limite") && `limite ${brl(Number(v["limite"]))}` },
  {
    chave: "orcamento",
    rotulo: "Orçamento do centro",
    detalhe: (v) => {
      const m = v["mensal"], c = v["comprometido"];
      return m != null || c != null ? `mensal ${brl(Number(m ?? 0))} · comprometido ${brl(Number(c ?? 0))}` : null;
    },
  },
  { chave: "vencimento", rotulo: "Vencimento", detalhe: (v) => txt(v, "vencimento", "data") },
];

export function valorChecagem(checagens: unknown, chave: string): { ok: boolean | null; detalhe: string | null } {
  if (!checagens || typeof checagens !== "object") return { ok: null, detalhe: null };
  const v = (checagens as Record<string, unknown>)[chave];
  const def = CHECAGENS.find((c) => c.chave === chave);
  if (typeof v === "boolean") return { ok: v, detalhe: null };
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const ok = "ok" in o ? Boolean(o.ok) : null;
    const detalhe = def?.detalhe ? def.detalhe(o) : null;
    return { ok, detalhe };
  }
  return { ok: null, detalhe: null };
}

// CNPJ: máscara e validação de dígitos verificadores
export function mascararCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function cnpjValido(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dig = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = dig(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dig(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}
