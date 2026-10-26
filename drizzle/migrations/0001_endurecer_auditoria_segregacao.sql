DROP POLICY IF EXISTS dem_insert ON public.demandas;
CREATE POLICY dem_insert ON public.demandas FOR INSERT TO authenticated
WITH CHECK (criado_por = auth.uid() AND status = 'recebida' AND rota IS NULL AND valor IS NULL AND extracao IS NULL);

DROP POLICY IF EXISTS apr_decidir ON public.aprovacoes;
REVOKE UPDATE ON public.aprovacoes FROM authenticated;
DROP POLICY IF EXISTS ev_insert ON public.eventos;
REVOKE INSERT ON public.eventos FROM authenticated;

CREATE OR REPLACE FUNCTION public.validar_decisao_aprovacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status <> 'pendente' THEN
      RAISE EXCEPTION 'Uma aprovação não pendente não pode mudar de status' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'rejeitada' AND COALESCE(length(trim(NEW.justificativa)), 0) < 10 THEN
      RAISE EXCEPTION 'Rejeição exige justificativa com ao menos 10 caracteres' USING ERRCODE = '23514';
    END IF;
    IF NEW.status IN ('aprovada', 'rejeitada') AND (NEW.decidido_por IS NULL OR NEW.decidido_em IS NULL) THEN
      RAISE EXCEPTION 'Decisão exige responsável e data' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_decisao_aprovacao
BEFORE UPDATE ON public.aprovacoes
FOR EACH ROW EXECUTE FUNCTION public.validar_decisao_aprovacao();