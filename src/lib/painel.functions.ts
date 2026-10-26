import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function papeisDe(supabase: any, userId: string): Promise<string[]> {
  const [g, a] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "gestor" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);
  const p: string[] = [];
  if (g.data) p.push("gestor");
  if (a.data) p.push("admin");
  return p;
}

async function exigirGestor(supabase: any, userId: string) {
  const p = await papeisDe(supabase, userId);
  if (!p.length) throw new Error("Só gestores e admins podem editar");
  return p;
}

async function exigirAdmin(supabase: any, userId: string) {
  const p = await papeisDe(supabase, userId);
  if (!p.includes("admin")) throw new Error("Só admins podem gerenciar papéis");
}

// ---- Integração n8n: só informa se as linhas existem, nunca os valores ----
export const statusIntegracao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = await admin();
    const { data, error } = await sb.from("integracao_segredos").select("nome");
    if (error) throw new Error("Falha ao verificar integração");
    const presentes = (data ?? []).map((r) => r.nome);
    const esperadas = ["n8n_webhook_url", "chave_integracao"];
    return {
      configurada: esperadas.every((e) => presentes.includes(e)),
      presentes,
      faltando: esperadas.filter((e) => !presentes.includes(e)),
    };
  });

// ---- Fornecedores (gestor/admin) ----
const fornecedorSchema = z.object({
  id: z.string().uuid().optional(),
  razao_social: z.string().trim().min(3, "Razão social obrigatória").max(300),
  cnpj: z.string().transform((s) => s.replace(/\D/g, "")).pipe(z.string().length(14, "CNPJ precisa ter 14 dígitos")),
  homologado: z.boolean().default(false),
  categoria_padrao: z.string().trim().max(120).optional().default(""),
});

export const salvarFornecedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => fornecedorSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirGestor(context.supabase, context.userId);
    const sb = await admin();
    const linha = {
      razao_social: data.razao_social,
      cnpj: data.cnpj,
      homologado: data.homologado,
      categoria_padrao: data.categoria_padrao || null,
    };
    const q = data.id
      ? sb.from("fornecedores").update(linha).eq("id", data.id)
      : sb.from("fornecedores").insert(linha);
    const { error } = await q;
    if (error) throw new Error(error.message.includes("unique") ? "Já existe fornecedor com este CNPJ" : "Falha ao salvar fornecedor");
    return { ok: true };
  });

export const excluirFornecedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirGestor(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb.from("fornecedores").delete().eq("id", data.id);
    if (error) throw new Error("Falha ao excluir fornecedor (há demandas ligadas a ele?)");
    return { ok: true };
  });

// ---- Centros de custo (gestor/admin) ----
const centroSchema = z.object({
  id: z.string().uuid().optional(),
  codigo: z.string().trim().min(1, "Código obrigatório").max(30),
  nome: z.string().trim().min(2, "Nome obrigatório").max(200),
  orcamento_mensal: z.coerce.number().min(0, "Orçamento não pode ser negativo"),
});

export const salvarCentroCusto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => centroSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirGestor(context.supabase, context.userId);
    const sb = await admin();
    const linha = { codigo: data.codigo, nome: data.nome, orcamento_mensal: data.orcamento_mensal };
    const q = data.id
      ? sb.from("centros_custo").update(linha).eq("id", data.id)
      : sb.from("centros_custo").insert(linha);
    const { error } = await q;
    if (error) throw new Error(error.message.includes("unique") ? "Já existe centro de custo com este código" : "Falha ao salvar centro de custo");
    return { ok: true };
  });

export const excluirCentroCusto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirGestor(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb.from("centros_custo").delete().eq("id", data.id);
    if (error) throw new Error("Falha ao excluir centro de custo (há demandas ligadas a ele?)");
    return { ok: true };
  });

// ---- Configurações (gestor/admin) ----
const CHAVES_CONFIG = ["limite_aprovacao_automatica", "confianca_minima", "prazo_aprovacao_horas", "janela_duplicidade_dias"] as const;

export const salvarConfiguracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ chave: z.enum(CHAVES_CONFIG), valor: z.coerce.number().min(0) }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirGestor(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb
      .from("configuracoes")
      .update({ valor: data.valor, atualizado_em: new Date().toISOString() })
      .eq("chave", data.chave);
    if (error) throw new Error("Falha ao salvar configuração");
    return { ok: true };
  });

// ---- Papéis (admin) ----
export const listarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context.supabase, context.userId);
    const sb = await admin();
    const [{ data: perfis }, { data: papeis }] = await Promise.all([
      sb.from("profiles").select("id, nome, email"),
      sb.from("user_roles").select("user_id, role"),
    ]);
    return (perfis ?? []).map((p) => ({
      id: p.id,
      nome: p.nome,
      email: p.email,
      papeis: (papeis ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
    }));
  });

export const alterarPapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), role: z.enum(["analista", "gestor", "admin"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId && data.role !== "admin")
      throw new Error("Você não pode remover o próprio papel de admin");
    const sb = await admin();
    const { error: e1 } = await sb.from("user_roles").delete().eq("user_id", data.user_id);
    if (e1) throw new Error("Falha ao alterar papel");
    const { error: e2 } = await sb.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    if (e2) throw new Error("Falha ao alterar papel");
    return { ok: true };
  });
