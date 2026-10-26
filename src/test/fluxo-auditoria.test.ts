import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (input: unknown) => unknown = (input) => input;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: typeof validate) => { validate = fn; return builder; },
      handler: (fn: (input: unknown) => unknown) => (input: { data: unknown; context: unknown }) =>
        fn({ ...input, data: validate(input.data) }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
const state = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: state.from } }));
import { decidirAprovacao, reprocessarRetomada } from "@/lib/fluxo.functions";

const userId = "00000000-0000-0000-0000-000000000001";
const aprovacaoId = "00000000-0000-0000-0000-000000000002";
const context = { userId, supabase: { rpc: state.rpc }, claims: {} };
// The mock builder exposes handler invocation, with validation, without HTTP transport.
const decidir = decidirAprovacao as unknown as (input: { data: unknown; context: unknown }) => Promise<unknown>;
const reprocessar = reprocessarRetomada as unknown as (input: { data: unknown; context: unknown }) => Promise<unknown>;

function result(data: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "limit", "update", "insert"]) chain[method] = vi.fn(() => chain);
  chain['maybeSingle'] = vi.fn(async () => ({ data, error: null }));
  chain['then'] = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
  return chain;
}

beforeEach(() => {
  vi.restoreAllMocks();
  state.from.mockReset();
  state.rpc.mockReset().mockResolvedValue({ data: true });
});

describe("Segregação e retomada", () => {
  it("recusa decisão de demanda app sem autor", async () => {
    state.from.mockReturnValue(result({ status: "pendente", demandas: { canal: "app", criado_por: null } }));
    await expect(decidir({ data: { aprovacao_id: aprovacaoId, decisao: "aprovar" }, context }))
      .rejects.toThrow("Demanda de app sem autor");
  });

  it("recusa decisão do próprio autor", async () => {
    state.from.mockReturnValue(result({ status: "pendente", demandas: { canal: "app", criado_por: userId } }));
    await expect(decidir({ data: { aprovacao_id: aprovacaoId, decisao: "aprovar" }, context }))
      .rejects.toThrow("Quem lançou a demanda");
  });

  it("recusa rejeição com justificativa menor que 10 caracteres", async () => {
    await expect(decidir({ data: { aprovacao_id: aprovacaoId, decisao: "rejeitar", justificativa: "123456789" }, context }))
      .rejects.toThrow("mín. 10 caracteres");
  });

  it("recusa reprocessamento por analista", async () => {
    state.rpc.mockResolvedValue({ data: false });
    await expect(reprocessar({ data: { aprovacao_id: aprovacaoId }, context })).rejects.toThrow("Só gestores");
    expect(state.from).not.toHaveBeenCalled();
  });

  it("recusa retomada de aprovação pendente", async () => {
    state.from.mockReturnValue(result({ status: "pendente" }));
    await expect(reprocessar({ data: { aprovacao_id: aprovacaoId }, context })).rejects.toThrow("precisa estar decidida");
  });

  it("recusa retomada de demanda já agendada", async () => {
    state.from.mockReturnValue(result({ status: "aprovada", demandas: { status: "agendada" } }));
    await expect(reprocessar({ data: { aprovacao_id: aprovacaoId }, context })).rejects.toThrow("não aguarda retomada");
  });

  it("recusa retomada quando já há pagamento", async () => {
    state.from.mockImplementation((table: string) => result(table === "pagamentos" ? [{ id: "pagamento" }]
      : { status: "aprovada", demandas: { status: "aprovada" } }));
    await expect(reprocessar({ data: { aprovacao_id: aprovacaoId }, context })).rejects.toThrow("já tem pagamento");
  });

  it.each([['aprovada', 'aprovar'], ['rejeitada', 'rejeitar']])("repete a decisão persistida %s e registra confirmação", async (status, decisao) => {
    const evento = result(null);
    state.from.mockImplementation((table: string) => {
      if (table === "aprovacoes") return result({ id: aprovacaoId, demanda_id: "demanda", status,
        demandas: { status }, resume_url: "https://n8n.example.test/resume", justificativa: "Decisão original", decidido_por_nome: "Gestora" });
      if (table === "pagamentos") return result([]);
      if (table === "integracao_segredos") return result([{ nome: "chave_integracao", valor: "test-only" }]);
      return evento;
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    await expect(reprocessar({ data: { aprovacao_id: aprovacaoId }, context })).resolves.toEqual({ ok: true, retomado: true });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      decisao, justificativa: "Decisão original", decidido_por_nome: "Gestora",
    });
    expect(evento['insert']).toHaveBeenCalledWith(expect.objectContaining({ mensagem: "Retomada reprocessada", origem: "app" }));
  });
});