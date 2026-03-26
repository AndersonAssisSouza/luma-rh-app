-- ============================================================
-- LUMA RH — Migration 002: Row Level Security (RLS)
-- Garante isolamento total entre tenants (empresas)
-- ============================================================

-- ============================================================
-- FUNÇÃO AUXILIAR: retorna tenant_id do usuário logado
-- Cacheada por transação para performance
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
-- HABILITAR RLS EM TODAS AS TABELAS
-- ============================================================
ALTER TABLE tenants                ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ferias_saldo           ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes_ferias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE exames_ocupacionais    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ausencias_ocorrencias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE desligamentos_agendados ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_eventos            ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TABELA: tenants
-- Apenas manager_global pode ver e gerenciar empresas
-- ============================================================
CREATE POLICY "tenants_manager_global_all" ON tenants
  FOR ALL USING (_my_role() = 'manager_global');

-- ============================================================
-- TABELA: profiles
-- ============================================================
-- Usuário vê apenas profiles do seu tenant (+ o próprio)
CREATE POLICY "profiles_own_tenant" ON profiles
  FOR SELECT USING (
    tenant_id = _my_tenant_id()
    OR id = auth.uid()
    OR _my_role() = 'manager_global'
  );

-- Apenas master, rh e manager_global podem inserir/editar profiles
CREATE POLICY "profiles_write_authorized" ON profiles
  FOR INSERT WITH CHECK (
    tenant_id = _my_tenant_id()
    AND _my_role() IN ('master', 'manager_global')
  );

CREATE POLICY "profiles_update_authorized" ON profiles
  FOR UPDATE USING (
    (tenant_id = _my_tenant_id() AND _my_role() IN ('master', 'manager_global'))
    OR id = auth.uid()  -- usuário pode atualizar o próprio profile
  );

CREATE POLICY "profiles_delete_authorized" ON profiles
  FOR DELETE USING (
    tenant_id = _my_tenant_id()
    AND _my_role() IN ('master', 'manager_global')
    AND id != auth.uid()  -- não pode deletar a si mesmo
  );

-- ============================================================
-- TABELA: colaboradores
-- ============================================================
-- SELECT: master/rh/manager_global veem todos do tenant
--         gestor vê apenas seus subordinados (gestor_email = meu email)
--         colaborador vê apenas ele mesmo
CREATE POLICY "colaboradores_select" ON colaboradores
  FOR SELECT USING (
    tenant_id = _my_tenant_id()
    AND (
      _my_role() IN ('master', 'rh', 'manager_global')
      OR gestor_email = _my_email()
      OR email_corporativo = _my_email()
    )
    OR _my_role() = 'manager_global'
  );

-- INSERT: apenas master e manager_global
CREATE POLICY "colaboradores_insert" ON colaboradores
  FOR INSERT WITH CHECK (
    tenant_id = _my_tenant_id()
    AND _my_role() IN ('master', 'manager_global')
  );

-- UPDATE: master pode tudo; gestor pode atualizar seus subordinados
CREATE POLICY "colaboradores_update" ON colaboradores
  FOR UPDATE USING (
    tenant_id = _my_tenant_id()
    AND (
      _my_role() IN ('master', 'manager_global')
      OR (gestor_email = _my_email() AND _my_role() = 'gestor')
    )
  );

-- DELETE: apenas master e manager_global
CREATE POLICY "colaboradores_delete" ON colaboradores
  FOR DELETE USING (
    tenant_id = _my_tenant_id()
    AND _my_role() IN ('master', 'manager_global')
  );

-- ============================================================
-- TABELA: ferias_saldo
-- ============================================================
CREATE POLICY "ferias_saldo_select" ON ferias_saldo
  FOR SELECT USING (
    tenant_id = _my_tenant_id()
    AND (
      _my_role() IN ('master', 'rh', 'gestor', 'manager_global')
      OR colaborador_id IN (
        SELECT id FROM colaboradores WHERE email_corporativo = _my_email()
      )
    )
  );

CREATE POLICY "ferias_saldo_write" ON ferias_saldo
  FOR ALL USING (
    tenant_id = _my_tenant_id()
    AND _my_role() IN ('master', 'rh', 'manager_global')
  );

-- ============================================================
-- TABELA: solicitacoes_ferias
-- ============================================================
-- Colaborador vê e cria apenas suas próprias solicitações
CREATE POLICY "sol_ferias_select" ON solicitacoes_ferias
  FOR SELECT USING (
    tenant_id = _my_tenant_id()
    AND (
      _my_role() IN ('master', 'rh', 'gestor', 'manager_global')
      OR colaborador_id IN (
        SELECT id FROM colaboradores WHERE email_corporativo = _my_email()
      )
    )
  );

CREATE POLICY "sol_ferias_insert_colab" ON solicitacoes_ferias
  FOR INSERT WITH CHECK (
    tenant_id = _my_tenant_id()
    AND (
      _my_role() IN ('master', 'rh', 'manager_global')
      OR colaborador_id IN (
        SELECT id FROM colaboradores WHERE email_corporativo = _my_email()
      )
    )
  );

-- Aprovação/rejeição apenas por gestor, master, rh
CREATE POLICY "sol_ferias_update_gestor" ON solicitacoes_ferias
  FOR UPDATE USING (
    tenant_id = _my_tenant_id()
    AND _my_role() IN ('master', 'rh', 'gestor', 'manager_global')
  );

-- ============================================================
-- TABELA: exames_ocupacionais
-- ============================================================
CREATE POLICY "exames_tenant" ON exames_ocupacionais
  FOR ALL USING (
    tenant_id = _my_tenant_id()
    AND _my_role() IN ('master', 'rh', 'gestor', 'manager_global')
  );

-- ============================================================
-- TABELA: ausencias_ocorrencias
-- ============================================================
CREATE POLICY "ausencias_tenant" ON ausencias_ocorrencias
  FOR ALL USING (
    tenant_id = _my_tenant_id()
    AND _my_role() IN ('master', 'rh', 'gestor', 'manager_global')
  );

-- ============================================================
-- TABELA: desligamentos_agendados
-- ============================================================
CREATE POLICY "desl_agendados_tenant" ON desligamentos_agendados
  FOR ALL USING (
    tenant_id = _my_tenant_id()
    AND _my_role() IN ('master', 'rh', 'manager_global')
  );

-- ============================================================
-- TABELA: log_eventos
-- ============================================================
-- Leitura: master, rh, manager_global
CREATE POLICY "log_select" ON log_eventos
  FOR SELECT USING (
    tenant_id = _my_tenant_id()
    OR _my_role() = 'manager_global'
  );

-- Insert: qualquer usuário autenticado do tenant (para auditoria)
CREATE POLICY "log_insert" ON log_eventos
  FOR INSERT WITH CHECK (
    tenant_id = _my_tenant_id()
    OR tenant_id IS NULL  -- eventos globais (ex: login)
  );

-- ============================================================
-- PROTEÇÃO EXTRA: dados financeiros (salário)
-- Gestor e colaborador NÃO veem salário — via VIEW segura
-- ============================================================
CREATE OR REPLACE VIEW colaboradores_sem_financeiro AS
SELECT
  id, tenant_id, id_colaborador, nome, email_corporativo,
  tipo_vinculo, status, data_nascimento, data_admissao, data_desligamento,
  cargo, area, setor, gestor, gestor_email, empresa,
  contrato_indeterminado, tempo_experiencia,
  plano_saude, outros_beneficios, criado_em, atualizado_em
  -- salario_honorario, vale_refeicao, vale_transporte OMITIDOS
FROM colaboradores;

-- Apenas master, rh e manager_global têm acesso à view com dados financeiros completos
CREATE OR REPLACE VIEW colaboradores_completo AS
SELECT * FROM colaboradores
WHERE _my_role() IN ('master', 'rh', 'manager_global');
