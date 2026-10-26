-- Execute through the database query tool. The final exception rolls back all writes.
DO $$
DECLARE
  bloqueada boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.demandas (codigo, criado_por, texto_original, status)
    VALUES ('AUDITORIA-ROLLBACK', '00000000-0000-0000-0000-000000000001', 'Teste transacional de bloqueio da inserção agendada', 'agendada');
  EXCEPTION WHEN insufficient_privilege THEN
    bloqueada := true;
  END;
  IF NOT bloqueada THEN
    RAISE EXCEPTION 'FALHA: authenticated conseguiu inserir demanda agendada';
  END IF;
  RAISE EXCEPTION 'PROVA OK: authenticated recusado ao inserir demanda com status agendada (RLS, SQLSTATE 42501); nenhum dado persistido';
END;
$$;