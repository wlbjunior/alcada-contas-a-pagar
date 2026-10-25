import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";

type DemandaUpdate = Database["public"]["Tables"]["demandas"]["Update"];
type Resultado = { status: number; body: Record<string, unknown> };

const ok = (dados: Record<string, unknown> = {}): Resultado => ({ status: 200, body: { ok: true, ...dados } });
const falha = (status: number, erro: string, detalhe = ""): Resultado => ({
  status,
  body: { ok: false, erro, detalhe },
});

class ErroIntegracao extends Error {
  constructor(public status: number, public codigo: string, detalhe: string) {
    super(detalhe);
  }
}

// Nota: para .maybeSingle() o valor pode ser null em tempo de execução; os chamadores verificam.
function checar<R extends { data: unknown; error: { message: string } | null }>(
  res: R,
  contexto: string,
): NonNullable<R["data"]> {
  if (res.error) throw new ErroIntegracao(500, "erro_banco", `${contexto}: ${res.error.message}`);
  return res.data as NonNullable<R["data"]>;
}

const sha = (v: string) => createHash("sha256").update(v, "utf8").digest();

/** Verifica x-alcada-key. Retorna null se autorizado, ou o Resultado de erro. */
export async function verificarChave(chave: string | null): Promise<Resultado | null> {
  const { data, error } = await supabaseAdmin
    .from("integracao_segredos")
    .select("valor")
    .eq("nome", "chave_integracao")
    .maybeSingle();
  if (error) return falha(500, "erro_banco", "falha ao verificar credencial");
  if (!data?.valor) return falha(503, "integracao_nao_configurada", "chave de integração não configurada");
  if (!chave) return falha(401, "nao_autorizado");
  if (!timingSafeEqual(sha(chave), sha(data.valor))) return falha(401, "nao_autorizado");
  return null;
}

// ---------- datas (America/Fortaleza, UTC-3 sem horário de verão) ----------
function hojeFortaleza(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function intervaloMes(): { inicio: string; fim: string } {
  const [y = 1970, m = 1] = hojeFortaleza().split("-").map(Number);
  const inicio = `${y}-${String(m).padStart(2, "0")}-01`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return { inicio, fim: `${ny}-${String(nm).padStart(2, "0")}-01` };
}

// ---------- helpers ----------
async function registrarEvento(e: {
  demanda_id?: string | null | undefined;
  etapa?: string | null;
  tipo?: string;
  mensagem: string;
  dados?: Json | null | undefined;
  origem?: string;
  execution_id?: string | null | undefined;
}) {
  checar(
    await supabaseAdmin.from("eventos").insert({
      demanda_id: e.demanda_id ?? null,
      etapa: e.etapa ?? null,
      tipo: e.tipo ?? "info",
      mensagem: e.mensagem,
      dados: e.dados ?? null,
      origem: e.origem ?? "n8n",
      execution_id: e.execution_id ?? null,
    }),
    "inserir evento",
  );
}

async function buscarDemanda(id: string) {
  const d = checar(
    await supabaseAdmin.from("demandas").select("*").eq("id", id).maybeSingle(),
    "buscar demanda",
  );
  if (!d) throw new ErroIntegracao(404, "demanda_nao_encontrada", `demanda ${id} não encontrada`);
  return d;
}

async function centroPorCodigo(codigo: string) {
  const c = checar(
    await supabaseAdmin.from("centros_custo").select("*").eq("codigo", codigo).maybeSingle(),
    "buscar centro de custo",
  );
  if (!c) throw new ErroIntegracao(404, "centro_custo_nao_encontrado", `centro de custo ${codigo} não encontrado`);
  return c;
}

const somenteDigitos = (v: string) => v.replace(/\D/g, "");

// ---------- schemas ----------
const uuid = z.string().uuid();
const jsonVal = z.custom<Json>(() => true);
const statusDemanda = z.enum([
  "recebida", "em_analise", "aguardando_aprovacao", "aprovada_auto", "aprovada",
  "rejeitada", "agendada", "escalada", "descartada", "erro",
]);

const schemas = {
  criar_demanda: z.object({
    canal: z.enum(["app", "formulario", "email"]),
    remetente_nome: z.string().max(300).nullish(),
    remetente_email: z.string().max(320).nullish(),
    texto_original: z.string().min(1).max(100000),
    n8n_execution_id: z.string().max(200).nullish(),
    criado_por: uuid.nullish(),
  }),
  contexto: z.object({
    demanda_id: uuid,
    cnpj: z.string().max(30).nullish(),
    valor: z.number().nullish(),
    numero_documento: z.string().max(200).nullish(),
    centro_custo_codigo: z.string().max(100).nullish(),
  }),
  atualizar_demanda: z.object({
    demanda_id: uuid,
    campos: z
      .object({
        status: statusDemanda,
        fornecedor_id: uuid.nullable(),
        fornecedor_nome: z.string().max(300).nullable(),
        cnpj: z.string().max(30).nullable(),
        valor: z.number().nullable(),
        vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
        numero_documento: z.string().max(200).nullable(),
        descricao: z.string().max(5000).nullable(),
        categoria: z.string().max(200).nullable(),
        centro_custo_id: uuid.nullable(),
        centro_custo_codigo: z.string().max(100).nullable(),
        tipo_documento: z.string().max(100).nullable(),
        prioridade: z.string().max(50).nullable(),
        confianca: z.number().min(0).max(1).nullable(),
        rota: z.enum(["automatica", "aprovacao", "excecao", "descarte"]).nullable(),
        motivos: z.array(z.string().max(1000)),
        checagens: jsonVal,
        extracao: jsonVal.nullable(),
        recomendacao_ia: z.string().max(10000).nullable(),
      })
      .partial(),
  }),
  evento: z.object({
    demanda_id: uuid.nullish(),
    etapa: z.string().max(200),
    tipo: z.enum(["info", "sucesso", "alerta", "erro", "decisao"]),
    mensagem: z.string().max(10000),
    dados: jsonVal.nullish(),
    origem: z.enum(["n8n", "app", "ia", "humano"]),
    execution_id: z.string().max(200).nullish(),
  }),
  ia_execucao: z.object({
    demanda_id: uuid,
    modelo: z.string().max(200),
    entrada_resumo: z.string().max(20000),
    saida: jsonVal.nullish(),
    latencia_ms: z.number().int().nonnegative(),
    sucesso: z.boolean(),
    erro: z.string().max(10000).nullish(),
  }),
  solicitar_aprovacao: z.object({
    demanda_id: uuid,
    motivo: z.string().max(5000),
    recomendacao_ia: z.string().max(10000),
    resume_url: z.string().url().max(2000),
    prazo_horas: z.number().positive().max(24 * 365),
  }),
  agendar_pagamento: z.object({
    demanda_id: uuid,
    origem: z.enum(["automatica", "aprovada"]),
  }),
  expirar_aprovacao: z.object({ demanda_id: uuid }),
  registrar_erro: z.object({
    n8n_execution_id: z.string().min(1).max(200),
    no: z.string().max(300),
    mensagem: z.string().max(10000),
  }),
};

type Acao = keyof typeof schemas;
type Dados<A extends Acao> = z.infer<(typeof schemas)[A]>;

// ---------- ações ----------
const acoes: { [A in Acao]: (d: Dados<A>) => Promise<Resultado> } = {
  async criar_demanda(d) {
    const nova = checar(
      await supabaseAdmin
        .from("demandas")
        .insert({
          canal: d.canal,
          remetente_nome: d.remetente_nome ?? null,
          remetente_email: d.remetente_email ?? null,
          texto_original: d.texto_original,
          n8n_execution_id: d.n8n_execution_id ?? null,
          criado_por: d.criado_por ?? null,
          status: "em_analise",
        })
        .select("id, codigo")
        .single(),
      "criar demanda",
    );
    await registrarEvento({
      demanda_id: nova.id,
      etapa: "recebimento",
      mensagem: `Demanda ${nova.codigo} criada via ${d.canal}`,
      execution_id: d.n8n_execution_id ?? null,
    });
    return ok({ id: nova.id, codigo: nova.codigo });
  },

  async contexto(d) {
    const cfgRows = checar(await supabaseAdmin.from("configuracoes").select("chave, valor"), "ler configurações");
    const config: Record<string, Json> = {};
    for (const r of cfgRows) config[r.chave] = r.valor;

    const cnpj = d.cnpj ? somenteDigitos(d.cnpj) : null;

    let fornecedor = null;
    let duplicidades: { codigo: string; valor: number | null; status: string; criado_em: string }[] = [];
    if (cnpj) {
      fornecedor = checar(
        await supabaseAdmin.from("fornecedores").select("*").eq("cnpj", cnpj).maybeSingle(),
        "buscar fornecedor",
      );
      const conds: string[] = [];
      if (d.numero_documento) conds.push(`numero_documento.eq.${JSON.stringify(d.numero_documento)}`);
      if (d.valor != null) conds.push(`valor.eq.${d.valor}`);
      if (conds.length) {
        const dias = Number(config["janela_duplicidade_dias"] ?? 90) || 90;
        const desde = new Date(Date.now() - dias * 86400000).toISOString();
        duplicidades = checar(
          await supabaseAdmin
            .from("demandas")
            .select("codigo, valor, status, criado_em")
            .eq("cnpj", cnpj)
            .neq("id", d.demanda_id)
            .not("status", "in", "(descartada,rejeitada)")
            .gte("criado_em", desde)
            .or(conds.join(","))
            .order("criado_em", { ascending: false }),
          "buscar duplicidades",
        );
      }
    }

    let centro_custo = null;
    if (d.centro_custo_codigo) {
      const cc = checar(
        await supabaseAdmin.from("centros_custo").select("*").eq("codigo", d.centro_custo_codigo).maybeSingle(),
        "buscar centro de custo",
      );
      if (cc) {
        const { inicio, fim } = intervaloMes();
        const pags = checar(
          await supabaseAdmin
            .from("pagamentos")
            .select("valor, demandas!inner(centro_custo_id)")
            .eq("demandas.centro_custo_id", cc.id)
            .neq("status", "cancelado")
            .gte("data_agendada", inicio)
            .lt("data_agendada", fim),
          "somar pagamentos",
        );
        const comprometido_mes = pags.reduce((s, p) => s + Number(p.valor ?? 0), 0);
        centro_custo = {
          id: cc.id,
          codigo: cc.codigo,
          nome: cc.nome,
          orcamento_mensal: Number(cc.orcamento_mensal),
          comprometido_mes: Math.round(comprometido_mes * 100) / 100,
        };
      }
    }

    return ok({ fornecedor, duplicidades, centro_custo, config });
  },

  async atualizar_demanda(d) {
    await buscarDemanda(d.demanda_id);
    const { centro_custo_codigo, ...resto } = d.campos;
    const upd: DemandaUpdate = { ...resto } as DemandaUpdate;
    if (upd.cnpj) upd.cnpj = somenteDigitos(upd.cnpj);
    if (centro_custo_codigo) upd.centro_custo_id = (await centroPorCodigo(centro_custo_codigo)).id;
    if (upd.cnpj) {
      const f = checar(
        await supabaseAdmin.from("fornecedores").select("id").eq("cnpj", upd.cnpj).maybeSingle(),
        "buscar fornecedor",
      );
      if (f) upd.fornecedor_id = f.id;
    }
    const chaves = Object.keys(upd);
    if (!chaves.length) return falha(400, "sem_campos", "nenhum campo permitido informado");
    upd.atualizado_em = new Date().toISOString();
    const atual = checar(
      await supabaseAdmin.from("demandas").update(upd).eq("id", d.demanda_id).select("id, codigo, status").single(),
      "atualizar demanda",
    );
    await registrarEvento({
      demanda_id: d.demanda_id,
      etapa: "atualizacao",
      mensagem: `Demanda ${atual.codigo} atualizada: ${chaves.join(", ")}`,
      dados: { campos: chaves, status: atual.status },
    });
    return ok({ id: atual.id, codigo: atual.codigo, status: atual.status, campos: chaves });
  },

  async evento(d) {
    if (d.demanda_id) await buscarDemanda(d.demanda_id);
    await registrarEvento({ ...d, dados: d.dados ?? null });
    return ok();
  },

  async ia_execucao(d) {
    await buscarDemanda(d.demanda_id);
    const row = checar(
      await supabaseAdmin
        .from("ia_execucoes")
        .insert({
          demanda_id: d.demanda_id,
          modelo: d.modelo,
          entrada_resumo: d.entrada_resumo,
          saida: d.saida ?? null,
          latencia_ms: d.latencia_ms,
          sucesso: d.sucesso,
          erro: d.erro ?? null,
        })
        .select("id")
        .single(),
      "registrar execução de IA",
    );
    await registrarEvento({
      demanda_id: d.demanda_id,
      etapa: "ia",
      tipo: d.sucesso ? "info" : "erro",
      mensagem: `Execução de IA (${d.modelo}) ${d.sucesso ? "concluída" : "falhou"} em ${d.latencia_ms} ms`,
      dados: { ia_execucao_id: row.id },
    });
    return ok({ id: row.id });
  },

  async solicitar_aprovacao(d) {
    const dem = await buscarDemanda(d.demanda_id);
    const prazo = new Date(Date.now() + d.prazo_horas * 3600000).toISOString();
    const apr = checar(
      await supabaseAdmin
        .from("aprovacoes")
        .insert({
          demanda_id: d.demanda_id,
          motivo: d.motivo,
          recomendacao_ia: d.recomendacao_ia,
          resume_url: d.resume_url,
          prazo,
          status: "pendente",
        })
        .select("id, prazo")
        .single(),
      "criar aprovação",
    );
    checar(
      await supabaseAdmin
        .from("demandas")
        .update({ status: "aguardando_aprovacao", atualizado_em: new Date().toISOString() })
        .eq("id", d.demanda_id),
      "atualizar demanda",
    );
    await registrarEvento({
      demanda_id: d.demanda_id,
      etapa: "aprovacao",
      tipo: "decisao",
      mensagem: `Aprovação solicitada para ${dem.codigo}: ${d.motivo}`,
      dados: { aprovacao_id: apr.id, prazo: apr.prazo },
    });
    return ok({ aprovacao_id: apr.id, prazo: apr.prazo });
  },

  async agendar_pagamento(d) {
    const dem = await buscarDemanda(d.demanda_id);
    const existente = checar(
      await supabaseAdmin.from("pagamentos").select("*").eq("demanda_id", d.demanda_id).maybeSingle(),
      "buscar pagamento",
    );
    if (existente) return ok({ pagamento: existente, ja_existia: true });

    const hoje = hojeFortaleza();
    const data_agendada = dem.vencimento && dem.vencimento >= hoje ? dem.vencimento : somarDias(hoje, 1);
    const pag = checar(
      await supabaseAdmin
        .from("pagamentos")
        .insert({ demanda_id: d.demanda_id, valor: dem.valor, data_agendada, status: "agendado" })
        .select("*")
        .single(),
      "criar pagamento",
    );
    checar(
      await supabaseAdmin
        .from("demandas")
        .update({ status: "agendada", atualizado_em: new Date().toISOString() })
        .eq("id", d.demanda_id),
      "atualizar demanda",
    );
    await registrarEvento({
      demanda_id: d.demanda_id,
      etapa: "pagamento",
      tipo: "sucesso",
      mensagem: `Pagamento de ${dem.codigo} agendado para ${data_agendada} (${d.origem === "automatica" ? "aprovação automática" : "aprovado por gestor"})`,
      dados: { pagamento_id: pag.id, origem: d.origem, valor: dem.valor, data_agendada },
    });
    return ok({ pagamento: pag, ja_existia: false });
  },

  async expirar_aprovacao(d) {
    const dem = await buscarDemanda(d.demanda_id);
    const expiradas = checar(
      await supabaseAdmin
        .from("aprovacoes")
        .update({ status: "expirada" })
        .eq("demanda_id", d.demanda_id)
        .eq("status", "pendente")
        .select("id"),
      "expirar aprovação",
    );
    if (!expiradas.length)
      return falha(404, "aprovacao_pendente_nao_encontrada", `nenhuma aprovação pendente para ${dem.codigo}`);
    checar(
      await supabaseAdmin
        .from("demandas")
        .update({ status: "escalada", atualizado_em: new Date().toISOString() })
        .eq("id", d.demanda_id),
      "atualizar demanda",
    );
    await registrarEvento({
      demanda_id: d.demanda_id,
      etapa: "aprovacao",
      tipo: "alerta",
      mensagem: `Aprovação de ${dem.codigo} expirou; demanda escalada`,
      dados: { aprovacoes: expiradas.map((a) => a.id) },
    });
    return ok({ aprovacoes_expiradas: expiradas.map((a) => a.id) });
  },

  async registrar_erro(d) {
    const dem = checar(
      await supabaseAdmin
        .from("demandas")
        .select("id, codigo")
        .eq("n8n_execution_id", d.n8n_execution_id)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
      "buscar demanda",
    );
    if (dem) {
      checar(
        await supabaseAdmin
          .from("demandas")
          .update({ status: "erro", atualizado_em: new Date().toISOString() })
          .eq("id", dem.id),
        "atualizar demanda",
      );
    }
    await registrarEvento({
      demanda_id: dem?.id ?? null,
      etapa: d.no,
      tipo: "erro",
      origem: "n8n",
      mensagem: d.mensagem,
      execution_id: d.n8n_execution_id,
      dados: { no: d.no },
    });
    return ok({ demanda_id: dem?.id ?? null, codigo: dem?.codigo ?? null });
  },
};

export async function processarAcao(corpo: unknown): Promise<Resultado> {
  if (!corpo || typeof corpo !== "object" || typeof (corpo as { acao?: unknown }).acao !== "string")
    return falha(400, "corpo_invalido", "esperado JSON com campo 'acao'");
  const { acao, ...resto } = corpo as { acao: string } & Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(schemas, acao))
    return falha(400, "acao_desconhecida", `ação '${acao}' não suportada`);
  const nome = acao as Acao;
  const parsed = schemas[nome].safeParse(resto);
  if (!parsed.success)
    return falha(
      400,
      "validacao",
      parsed.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; "),
    );
  try {
    return await (acoes[nome] as (d: unknown) => Promise<Resultado>)(parsed.data);
  } catch (e) {
    if (e instanceof ErroIntegracao) return falha(e.status, e.codigo, e.message);
    console.error("[integracao] erro inesperado na ação", nome);
    return falha(500, "erro_interno", e instanceof Error ? e.message : "erro desconhecido");
  }
}
