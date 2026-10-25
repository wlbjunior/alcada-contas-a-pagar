import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function segredos(nomes: string[]) {
  const sb = await admin();
  const { data, error } = await sb.from("integracao_segredos").select("nome, valor").in("nome", nomes);
  if (error) throw new Error("Falha ao ler configuração de integração");
  return Object.fromEntries((data ?? []).map((r) => [r.nome, r.valor])) as Record<string, string | undefined>;
}

async function postar(url: string, chave: string, corpo: unknown): Promise<{ ok: boolean; detalhe: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-alcada-key": chave },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });
    return { ok: r.ok, detalhe: `HTTP ${r.status}` };
  } catch (e) {
    const msg = e instanceof Error ? (e.name === "AbortError" ? "tempo esgotado (15 s)" : e.message) : String(e);
    return { ok: false, detalhe: msg };
  } finally {
    clearTimeout(t);
  }
}

type DemandaEnvio = {
  id: string;
  codigo: string;
  canal: string;
  remetente_nome: string | null;
  remetente_email: string | null;
  texto_original: string;
};

async function dispararN8n(d: DemandaEnvio): Promise<boolean> {
  const sb = await admin();
  const s = await segredos(["n8n_webhook_url", "chave_integracao"]);
  let res: { ok: boolean; detalhe: string };
  if (!s.n8n_webhook_url || !s.chave_integracao) {
    res = { ok: false, detalhe: "URL do webhook ou chave de integração não configurada" };
  } else {
    res = await postar(s.n8n_webhook_url, s.chave_integracao, {
      demanda_id: d.id,
      codigo: d.codigo,
      canal: d.canal,
      remetente_nome: d.remetente_nome,
      remetente_email: d.remetente_email,
      texto_original: d.texto_original,
    });
  }
  if (res.ok) {
    await sb.from("eventos").insert({
      demanda_id: d.id, origem: "app", tipo: "info", etapa: "envio",
      mensagem: "Enviada ao orquestrador n8n",
    });
    return true;
  }
  await sb.from("demandas").update({ status: "erro" }).eq("id", d.id);
  await sb.from("eventos").insert({
    demanda_id: d.id, origem: "app", tipo: "erro", etapa: "envio",
    mensagem: `Orquestrador indisponível: ${res.detalhe}`,
  });
  return false;
}

async function ehGestor(supabase: any, userId: string) {
  const [g, a] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "gestor" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);
  return Boolean(g.data) || Boolean(a.data);
}

const envioSchema = z.object({
  canal: z.enum(["app", "email"]),
  remetente_nome: z.string().trim().max(200).optional().default(""),
  remetente_email: z.union([z.literal(""), z.string().trim().email().max(255)]).optional().default(""),
  texto_original: z.string().trim().min(20, "O texto precisa ter ao menos 20 caracteres").max(8000, "Máximo de 8000 caracteres"),
});

export const enviarDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => envioSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: dem, error } = await context.supabase
      .from("demandas")
      .insert({
        canal: data.canal,
        remetente_nome: data.remetente_nome || null,
        remetente_email: data.remetente_email || null,
        texto_original: data.texto_original,
        criado_por: context.userId,
        status: "recebida",
      })
      .select("id, codigo, canal, remetente_nome, remetente_email, texto_original")
      .single();
    if (error || !dem) throw new Error("Não foi possível registrar a demanda");
    const enviado = await dispararN8n(dem);
    return { id: dem.id, codigo: dem.codigo, enviado };
  });

export const reenviarDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ demanda_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await ehGestor(context.supabase, context.userId))) throw new Error("Só gestores podem reenviar demandas");
    const sb = await admin();
    const { data: dem } = await sb
      .from("demandas")
      .select("id, codigo, canal, remetente_nome, remetente_email, texto_original, status")
      .eq("id", data.demanda_id)
      .maybeSingle();
    if (!dem) throw new Error("Demanda não encontrada");
    if (dem.status !== "erro" && dem.status !== "recebida") throw new Error("Só é possível reenviar demandas com status 'erro' ou 'recebida'");
    await sb.from("demandas").update({ status: "recebida" }).eq("id", dem.id);
    const enviado = await dispararN8n(dem);
    return { id: dem.id, codigo: dem.codigo, enviado };
  });

const decisaoSchema = z
  .object({
    aprovacao_id: z.string().uuid(),
    decisao: z.enum(["aprovar", "rejeitar"]),
    justificativa: z.string().trim().max(2000).optional().default(""),
  })
  .refine((v) => v.decisao !== "rejeitar" || v.justificativa.length >= 10, {
    message: "Justificativa obrigatória (mín. 10 caracteres) ao rejeitar",
    path: ["justificativa"],
  });

export const decidirAprovacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => decisaoSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await ehGestor(context.supabase, context.userId))) throw new Error("Só gestores decidem pagamentos");
    const sb = await admin();
    const { data: ap } = await sb
      .from("aprovacoes")
      .select("id, status, prazo, resume_url, demanda_id, demandas(criado_por, codigo)")
      .eq("id", data.aprovacao_id)
      .maybeSingle();
    if (!ap) throw new Error("Aprovação não encontrada");
    if (ap.status !== "pendente") throw new Error("Esta aprovação não está mais pendente");
    if (ap.prazo && new Date(ap.prazo).getTime() < Date.now()) throw new Error("O prazo desta aprovação expirou");
    const dem = ap.demandas as unknown as { criado_por: string | null; codigo: string } | null;
    if (dem?.criado_por === context.userId) throw new Error("Quem lançou a demanda não pode aprová-la");

    const { data: perfil } = await sb.from("profiles").select("nome, email").eq("id", context.userId).maybeSingle();
    const nome = perfil?.nome || perfil?.email || (context.claims as any)?.email || "gestor";
    const novo = data.decisao === "aprovar" ? "aprovada" : "rejeitada";
    const agora = new Date().toISOString();

    const { data: upd, error } = await sb
      .from("aprovacoes")
      .update({
        status: novo, decidido_por: context.userId, decidido_por_nome: nome,
        decidido_em: agora, justificativa: data.justificativa || null,
      })
      .eq("id", ap.id)
      .eq("status", "pendente")
      .select("id");
    if (error || !upd?.length) throw new Error("Não foi possível gravar a decisão");
    await sb.from("demandas").update({ status: novo }).eq("id", ap.demanda_id);
    await sb.from("eventos").insert({
      demanda_id: ap.demanda_id, origem: "humano", tipo: "decisao", etapa: "aprovacao",
      mensagem: `${novo === "aprovada" ? "Aprovada" : "Rejeitada"} por ${nome}${data.justificativa ? `: ${data.justificativa}` : ""}`,
      dados: { aprovacao_id: ap.id, decisao: data.decisao },
    });

    let retomado = false;
    const s = await segredos(["chave_integracao"]);
    if (ap.resume_url && s.chave_integracao) {
      const r = await postar(ap.resume_url, s.chave_integracao, {
        decisao: data.decisao, justificativa: data.justificativa || null, decidido_por_nome: nome,
      });
      retomado = r.ok;
      if (!r.ok) {
        await sb.from("eventos").insert({
          demanda_id: ap.demanda_id, origem: "app", tipo: "erro", etapa: "retomada",
          mensagem: "Decisão gravada, mas o n8n não confirmou a retomada", dados: { detalhe: r.detalhe },
        });
      }
    } else {
      await sb.from("eventos").insert({
        demanda_id: ap.demanda_id, origem: "app", tipo: "erro", etapa: "retomada",
        mensagem: "Decisão gravada, mas o n8n não confirmou a retomada",
        dados: { detalhe: ap.resume_url ? "chave de integração ausente" : "resume_url ausente" },
      });
    }
    return { ok: true, status: novo, retomado };
  });
