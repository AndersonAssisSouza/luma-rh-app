-- ============================================================
-- LUMA RH — Migration 008: Corrigir race condition em gen_id_colaborador
-- Problema: SELECT MAX() sem lock permite que duas transações concorrentes
-- gerem o mesmo id_colaborador para o mesmo tenant.
-- Correção: pg_advisory_xact_lock() serializa a geração por tenant.
-- Data: 2026-03-27
-- ============================================================

CREATE OR REPLACE FUNCTION gen_id_colaborador(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _last integer;
BEGIN
  -- Lock exclusivo por tenant (liberado automaticamente ao fim da transação)
  -- hashtext garante que o lock é único por tenant sem colisão entre tenants distintos
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text));

  SELECT COALESCE(
    MAX(CAST(REPLACE(id_colaborador, 'COL-', '') AS integer)),
    0
  ) INTO _last
  FROM colaboradores
  WHERE tenant_id = p_tenant_id
    AND id_colaborador ~ '^COL-[0-9]+$';

  RETURN 'COL-' || LPAD((_last + 1)::text, 3, '0');
END;
$$;
