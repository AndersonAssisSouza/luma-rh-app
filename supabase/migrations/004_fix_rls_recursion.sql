-- ============================================================
-- LUMA RH — Migration 004: Corrige recursão nas funções RLS
-- Problema: _my_role(), _my_tenant_id() e _my_email() fazem
-- SELECT em profiles, mas profiles tem RLS que chama essas
-- mesmas funções → "stack depth limit exceeded"
-- Solução: SECURITY DEFINER + SET search_path
-- ============================================================

CREATE OR REPLACE FUNCTION _my_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION _my_role()
RETURNS text
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION _my_email()
RETURNS text
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM profiles WHERE id = auth.uid()
$$;
