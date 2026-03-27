-- ============================================================
-- LUMA RH — Migration 006: Corrige RLS da tabela tenants
-- Problema: policy FOR ALL só permitia manager_global.
--   master/rh não conseguiam ler/escrever a própria config.
-- ============================================================

-- Remove a política genérica (FOR ALL → manager_global only)
DROP POLICY IF EXISTS "tenants_manager_global" ON tenants;

-- SELECT: manager_global vê tudo; master/rh/gestor veem o próprio tenant
CREATE POLICY "tenants_select" ON tenants
  FOR SELECT USING (
    _my_role() = 'manager_global'
    OR id = _my_tenant_id()
  );

-- INSERT/DELETE: apenas manager_global cria ou remove tenants
CREATE POLICY "tenants_insert" ON tenants
  FOR INSERT WITH CHECK (_my_role() = 'manager_global');

CREATE POLICY "tenants_delete" ON tenants
  FOR DELETE USING (_my_role() = 'manager_global');

-- UPDATE: manager_global atualiza qualquer tenant; master atualiza o próprio
CREATE POLICY "tenants_update" ON tenants
  FOR UPDATE USING (
    _my_role() = 'manager_global'
    OR (_my_role() = 'master' AND id = _my_tenant_id())
  );
