-- ============================================================
-- LUMA RH — Migration 002: Row Level Security (RLS)
-- Garante isolamento total entre tenants (empresas)
-- ============================================================

-- ============================================================
-- FUNÇÃO AUXILIAR: retorna tenant_id do usuário logado
-- ============================================================
CREATE OR REPLACE FUNCTION _my_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- FUNÇÃO AUXILIAR: retorna role do usuário logado
-- ============================================================
CREATE OR REPLACE FUNCTION _my_role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- FUNÇÃO AUXILIAR: retorna email do usuário logado
-- ============================================================
CREATE OR REPLACE FUNCTION _my_email()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT email FROM profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- NOTA SOBRE manager_global:
-- manager_global tem tenant_id = NULL no profiles.
-- SQL: NULL = qualquer_valor é sempre FALSE.
-- Por isso todas as políticas verificam _my_role() = 'manager_global'
-- PRIMEIRO, como condição de saída rápida (OR de curto-circuito).
-- ============================================================

-- ============================================================
-- HABILITAR RLS EM TODAS AS TABELAS
-- ============================================================
ALTER TABLE tenants                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ferias_saldo            ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes_ferias     ENABLE ROW LEVEL SECURITY;
ALTER TABLE exames_ocupacionais     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ausencias_ocorrencias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE desligamentos_agendados ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_eventos             ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TABELA: tenants
-- Apenas manager_global pode gerenciar empresas
-- ============================================================
CREATE POLICY "tenants_manager_global" ON tenants
  FOR ALL USING (_my_role() = 'manager_global');

-- ============================================================
-- TABELA: profiles
-- ============================================================
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    _my_role() = 'manager_global'
    OR id = auth.uid()
    OR tenant_id = _my_tenant_id()
  );

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (
    _my_role() = 'manager_global'
    OR (
      tenant_id = _my_tenant_id()
      AND _my_role() = 'master'
    )
  );

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (
    _my_role() = 'manager_global'
    OR id = auth.uid()
    OR (tenant_id = _my_tenant_id() AND _my_role() = 'master')
  );

CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE USING (
    (_my_role() = 'manager_global' OR (tenant_id = _my_tenant_id() AND _my_role() = 'master'))
    AND id != auth.uid()
  );

-- ============================================================
-- TABELA: colaboradores
-- ============================================================
CREATE POLICY "colaboradores_select" ON colaboradores
  FOR SELECT USING (
    _my_role() = 'manager_global'
    OR (
      tenant_id = _my_tenant_id()
      AND (
        _my_role() IN ('master', 'rh')
        OR gestor_email = _my_email()
        OR email_corporativo = _my_email()
      )
    )
  );

CREATE POLICY "colaboradores_insert" ON colaboradores
  FOR INSERT WITH CHECK (
    _my_role() = 'manager_global'
    OR (tenant_id = _my_tenant_id() AND _my_role() IN ('master', 'rh'))
  );

CREATE POLICY "colaboradores_update" ON colaboradores
  FOR UPDATE USING (
    _my_role() = 'manager_global'
    OR (tenant_id = _my_tenant_id() AND _my_role() IN ('master', 'rh'))
    OR (tenant_id = _my_tenant_id() AND gestor_email = _my_email() AND _my_role() = 'gestor')
  );

CREATE POLICY "colaboradores_delete" ON colaboradores
  FOR DELETE USING (
    _my_role() = 'manager_global'
    OR (tenant_id = _my_tenant_id() AND _my_role() = 'master')
  );

-- ============================================================
-- TABELA: ferias_saldo
-- ============================================================
CREATE POLICY "ferias_saldo_select" ON ferias_saldo
  FOR SELECT USING (
    _my_role() = 'manager_global'
    OR (
      tenant_id = _my_tenant_id()
      AND (
        _my_role() IN ('master', 'rh', 'gestor')
        OR colaborador_id IN (
          SELECT id FROM colaboradores WHERE email_corporativo = _my_email()
        )
      )
    )
  );

CREATE POLICY "ferias_saldo_write" ON ferias_saldo
  FOR ALL USING (
    _my_role() = 'manager_global'
    OR (tenant_id = _my_tenant_id() AND _my_role() IN ('master', 'rh'))
  );

-- ============================================================
-- TABELA: solicitacoes_ferias
-- ============================================================
CREATE POLICY "sol_ferias_select" ON solicitacoes_ferias
  FOR SELECT USING (
    _my_role() = 'manager_global'
    OR (
      tenant_id = _my_tenant_id()
      AND (
        _my_role() IN ('master', 'rh', 'gestor')
        OR colaborador_id IN (
          SELECT id FROM colaboradores WHERE email_corporativo = _my_email()
        )
      )
    )
  );

CREATE POLICY "sol_ferias_insert" ON solicitacoes_ferias
  FOR INSERT WITH CHECK (
    _my_role() = 'manager_global'
    OR (
      tenant_id = _my_tenant_id()
      AND (
        _my_role() IN ('master', 'rh')
        OR colaborador_id IN (
          SELECT id FROM colaboradores WHERE email_corporativo = _my_email()
        )
      )
    )
  );

CREATE POLICY "sol_ferias_update" ON solicitacoes_ferias
  FOR UPDATE USING (
    _my_role() = 'manager_global'
    OR (tenant_id = _my_tenant_id() AND _my_role() IN ('master', 'rh', 'gestor'))
  );

-- ============================================================
-- TABELA: exames_ocupacionais
-- ============================================================
CREATE POLICY "exames_all" ON exames_ocupacionais
  FOR ALL USING (
    _my_role() = 'manager_global'
    OR (tenant_id = _my_tenant_id() AND _my_role() IN ('master', 'rh', 'gestor'))
  );

-- ============================================================
-- TABELA: ausencias_ocorrencias
-- ============================================================
CREATE POLICY "ausencias_all" ON ausencias_ocorrencias
  FOR ALL USING (
    _my_role() = 'manager_global'
    OR (tenant_id = _my_tenant_id() AND _my_role() IN ('master', 'rh', 'gestor'))
  );

-- ============================================================
-- TABELA: desligamentos_agendados
-- ============================================================
CREATE POLICY "desl_agendados_all" ON desligamentos_agendados
  FOR ALL USING (
    _my_role() = 'manager_global'
    OR (tenant_id = _my_tenant_id() AND _my_role() IN ('master', 'rh'))
  );

-- ============================================================
-- TABELA: log_eventos
-- ============================================================
CREATE POLICY "log_select" ON log_eventos
  FOR SELECT USING (
    _my_role() = 'manager_global'
    OR tenant_id = _my_tenant_id()
  );

CREATE POLICY "log_insert" ON log_eventos
  FOR INSERT WITH CHECK (
    _my_role() = 'manager_global'
    OR tenant_id = _my_tenant_id()
    OR tenant_id IS NULL
  );

-- ============================================================
-- VIEWS SEGURAS (dados financeiros)
-- gestor e colaborador NÃO veem salário, VR, VT
-- ============================================================
CREATE OR REPLACE VIEW v_colaboradores_sem_financeiro
WITH (security_invoker = true) AS
SELECT
  id, tenant_id, id_colaborador, nome, email_corporativo,
  tipo_vinculo, status, data_nascimento, data_admissao, data_desligamento,
  cargo, area, setor, gestor, gestor_email, empresa,
  contrato_indeterminado, tempo_experiencia,
  plano_saude, outros_beneficios, criado_em, atualizado_em
FROM colaboradores;
-- salario_honorario, vale_refeicao, vale_transporte omitidos

-- View completa apenas para master, rh, manager_global
CREATE OR REPLACE VIEW v_colaboradores_financeiro
WITH (security_invoker = true) AS
SELECT * FROM colaboradores
WHERE _my_role() IN ('master', 'rh', 'manager_global');
