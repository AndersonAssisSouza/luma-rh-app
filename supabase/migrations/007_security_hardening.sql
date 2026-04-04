-- ============================================================
-- LUMA RH — Migration 007: Security Hardening
-- Corrige vulnerabilidades identificadas em auditoria de segurança
-- Data: 2026-03-27
-- ============================================================

-- ============================================================
-- CORREÇÃO 1 (CRÍTICA): Trigger handle_new_user()
-- Problema: aceitava role e tenant_id de raw_user_meta_data,
-- permitindo que qualquer usuário se auto-elevasse para master/admin
-- Correção: ignorar role/tenant_id do metadata; sempre criar como 'colaborador'
-- Promoção deve ser feita manualmente pelo admin via manager.html
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nome, email, role, tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    'colaborador',  -- SEMPRE colaborador; nunca aceitar role do metadata
    NULL            -- tenant_id NULO; admin associa o usuário ao tenant manualmente
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CORREÇÃO 2 (CRÍTICA): Restringir acesso a log_eventos
-- Problema: colaboradores conseguiam ver logs com dados financeiros (salários, etc.)
-- Correção: apenas master, rh e manager_global acessam logs
-- ============================================================
DROP POLICY IF EXISTS "log_select" ON log_eventos;
CREATE POLICY "log_select" ON log_eventos
  FOR SELECT USING (
    _my_role() = 'manager_global'
    OR (_my_role() IN ('master', 'rh') AND tenant_id = _my_tenant_id())
  );

-- ============================================================
-- CORREÇÃO 3 (CRÍTICA): Mascarar dados financeiros nos logs de auditoria
-- Problema: _audit_log() logava o registro completo, incluindo salario_honorario,
-- vale_refeicao, vale_transporte e outros dados sensíveis na coluna 'dados'
-- Correção: remover campos financeiros e PII sensível antes de logar
-- ============================================================
CREATE OR REPLACE FUNCTION _audit_log()
RETURNS TRIGGER AS $$
DECLARE
  _tenant_id uuid;
  _tipo      text;
  _dados     jsonb;
  _raw       jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _tenant_id := OLD.tenant_id;
    _raw := to_jsonb(OLD);
  ELSE
    _tenant_id := NEW.tenant_id;
    _raw := to_jsonb(NEW);
  END IF;

  -- Remover campos financeiros e PII sensível do log
  _dados := _raw
    - 'salario_honorario'
    - 'vale_refeicao'
    - 'vale_transporte'
    - 'data_nascimento'
    - 'outros_beneficios';

  _tipo := TG_TABLE_NAME || '_' || TG_OP;

  INSERT INTO log_eventos (tenant_id, tipo, descricao, dados, usuario_id)
  VALUES (
    _tenant_id,
    _tipo,
    TG_OP || ' em ' || TG_TABLE_NAME,
    _dados,
    auth.uid()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CORREÇÃO 4: Restringir INSERT em log_eventos
-- Problema: a policy log_insert permitia tenant_id IS NULL,
-- o que poderia ser explorado via service_role sem tenant
-- Correção: manter apenas inserções autenticadas com tenant válido
-- ============================================================
DROP POLICY IF EXISTS "log_insert" ON log_eventos;
CREATE POLICY "log_insert" ON log_eventos
  FOR INSERT WITH CHECK (
    _my_role() = 'manager_global'
    OR (tenant_id = _my_tenant_id() AND _my_tenant_id() IS NOT NULL)
  );

-- ============================================================
-- CORREÇÃO 5: Bloquear auto-elevação de role via updateProfile
-- Problema: policy profiles_update permitia que o próprio usuário
-- atualizasse seu profile, incluindo potencialmente o campo 'role'
-- Correção: usar função SECURITY DEFINER para updates de profile
-- que bloqueia alteração de role/tenant_id por não-admin
-- ============================================================

-- Função segura para atualizar próprio profile (sem role/tenant_id)
CREATE OR REPLACE FUNCTION update_own_profile(p_nome text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só permite atualizar nome; role e tenant_id são imutáveis pelo próprio usuário
  UPDATE profiles
  SET nome = p_nome, atualizado_em = now()
  WHERE id = auth.uid();
END;
$$;

-- Revogar permissão de UPDATE direto na tabela profiles para colaboradores
-- (apenas manager_global e master podem fazer UPDATE direto)
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (
    _my_role() = 'manager_global'
    OR (tenant_id = _my_tenant_id() AND _my_role() = 'master' AND id != auth.uid())
    -- Nota: colaboradores/gestores/rh devem usar a função update_own_profile()
    -- para atualizar apenas campos não-privilegiados
  );

-- ============================================================
-- CORREÇÃO 6: Adicionar constraint CHECK para validar role
-- Impede inserção de roles inválidos diretamente no banco
-- ============================================================
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('manager_global', 'master', 'gestor', 'rh', 'colaborador'));

-- ============================================================
-- CORREÇÃO 7: Adicionar constraints CHECK para campos enum em colaboradores
-- Valida tipo_vinculo e status no banco, não apenas no frontend
-- ============================================================
ALTER TABLE colaboradores
  DROP CONSTRAINT IF EXISTS colaboradores_tipo_vinculo_check;
ALTER TABLE colaboradores
  DROP CONSTRAINT IF EXISTS colaboradores_status_check;

ALTER TABLE colaboradores
  ADD CONSTRAINT colaboradores_tipo_vinculo_check
  CHECK (tipo_vinculo IS NULL OR tipo_vinculo IN ('CLT', 'PJ', 'MEI', 'SOCIO', 'ASSOCIADO', 'ESTAGIARIO'));

ALTER TABLE colaboradores
  ADD CONSTRAINT colaboradores_status_check
  CHECK (status IS NULL OR status IN ('ATIVO', 'DESLIGADO', 'AFASTADO'));

-- ============================================================
-- CORREÇÃO 8: Validar status de solicitações de férias
-- ============================================================
ALTER TABLE solicitacoes_ferias
  DROP CONSTRAINT IF EXISTS sol_ferias_status_check;

ALTER TABLE solicitacoes_ferias
  ADD CONSTRAINT sol_ferias_status_check
  CHECK (status IN ('PENDENTE', 'APROVADO', 'REJEITADO'));

-- ============================================================
-- CORREÇÃO 9: Restringir tenant_id em profiles
-- Garante que tenant_id de perfis não-manager_global nunca seja NULL
-- após associação inicial (feita pelo admin)
-- ============================================================
-- Nota: não adicionamos NOT NULL aqui pois o fluxo de criação via
-- handle_new_user() cria com NULL e o admin associa depois.
-- A restrição é feita via lógica de negócio na aplicação.

-- ============================================================
-- COMENTÁRIOS FINAIS
-- Após aplicar esta migration:
-- 1. Revogar a SUPABASE_SERVICE_KEY atual no Supabase Dashboard
--    e gerar uma nova chave
-- 2. Desabilitar self-registration: Auth → Settings → Disable sign up
-- 3. Verificar configurações CORS: Settings → API → Allowed Origins
--    (não deve conter '*')
-- ============================================================
