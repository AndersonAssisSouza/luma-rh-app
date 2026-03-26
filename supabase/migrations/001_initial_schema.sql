-- ============================================================
-- LUMA RH — Migration 001: Schema Inicial
-- Arquitetura multi-tenant com isolamento por empresa (tenant)
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABELA: tenants (empresas clientes)
-- ============================================================
CREATE TABLE tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  slug          text UNIQUE NOT NULL,          -- ex: 'luisa-moraes-advogados'
  email_admin   text NOT NULL,
  plano         text NOT NULL DEFAULT 'TRIAL', -- TRIAL | BASICO | PRO | ENTERPRISE
  status        text NOT NULL DEFAULT 'ATIVO', -- ATIVO | INATIVO | SUSPENSO
  max_usuarios  integer DEFAULT 10,
  config        jsonb DEFAULT '{}',            -- configurações extras por tenant
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- ============================================================
-- TABELA: profiles (usuários — estende auth.users)
-- ============================================================
CREATE TABLE profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id     uuid REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = manager_global
  nome          text NOT NULL,
  email         text NOT NULL UNIQUE,
  role          text NOT NULL DEFAULT 'colaborador',
  -- roles: 'manager_global' | 'master' | 'gestor' | 'rh' | 'colaborador'
  status        text NOT NULL DEFAULT 'ATIVO', -- ATIVO | INATIVO | BLOQUEADO
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- ============================================================
-- TABELA: colaboradores (CADASTRO_COLABORADORES)
-- ============================================================
CREATE TABLE colaboradores (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id_colaborador        text NOT NULL,          -- COL-001
  nome                  text NOT NULL,
  email_corporativo     text,
  tipo_vinculo          text,                   -- CLT | PJ | MEI | SOCIO | ASSOCIADO | ESTAGIARIO
  status                text DEFAULT 'ATIVO',   -- ATIVO | DESLIGADO | AFASTADO
  data_nascimento       date,
  data_admissao         date,
  data_desligamento     date,
  cargo                 text,
  area                  text,
  setor                 text,
  gestor                text,                   -- nome do gestor
  gestor_email          text,                   -- email do gestor
  empresa               text,
  contrato_indeterminado boolean DEFAULT false,
  tempo_experiencia     integer,               -- dias de experiência (até 90)
  salario_honorario     numeric(12,2),
  vale_refeicao         numeric(12,2),
  vale_transporte       numeric(12,2),
  plano_saude           text,                   -- SIM | NAO
  outros_beneficios     text,
  criado_em             timestamptz DEFAULT now(),
  atualizado_em         timestamptz DEFAULT now(),
  UNIQUE (tenant_id, id_colaborador)
);

-- ============================================================
-- TABELA: ferias_saldo (FERIAS_CLT)
-- ============================================================
CREATE TABLE ferias_saldo (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  colaborador_id            uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  inicio_periodo_aquisitivo date,
  fim_periodo_aquisitivo    date,
  fim_periodo_concessivo    date,
  ferias_programadas_inicio date,
  ferias_programadas_fim    date,
  ferias_gozadas_inicio     date,
  ferias_gozadas_fim        date,
  status_ferias             text DEFAULT 'NAO_PROGRAMADA',
  -- NAO_PROGRAMADA | PROGRAMADA | GOZADA | NAO_APLICAVEL | INATIVO
  criado_em                 timestamptz DEFAULT now(),
  atualizado_em             timestamptz DEFAULT now(),
  UNIQUE (tenant_id, colaborador_id)
);

-- ============================================================
-- TABELA: solicitacoes_ferias (luma_ferias_v2 localStorage)
-- ============================================================
CREATE TABLE solicitacoes_ferias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  colaborador_id  uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  protocolo       text UNIQUE NOT NULL,         -- SOL-{timestamp}
  data_inicio     date NOT NULL,
  data_fim        date NOT NULL,
  dias_corridos   integer NOT NULL,
  dias_uteis      integer,
  observacao      text,
  status          text NOT NULL DEFAULT 'PENDENTE', -- PENDENTE | APROVADO | REJEITADO
  motivo_rejeicao text,
  solicitado_em   timestamptz DEFAULT now(),
  decisao_em      timestamptz,
  criado_em       timestamptz DEFAULT now()
);

-- ============================================================
-- TABELA: exames_ocupacionais (EXAMES_OCUPACIONAIS)
-- ============================================================
CREATE TABLE exames_ocupacionais (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  tipo_exame     text,                          -- ADMISSIONAL | PERIODICO | DEMISSIONAL
  ultimo_exame   date,
  proximo_exame  date,
  status_exame   text,                          -- EM_DIA | VENCIDO | INATIVO
  observacao     text,
  criado_em      timestamptz DEFAULT now(),
  atualizado_em  timestamptz DEFAULT now()
);

-- ============================================================
-- TABELA: ausencias_ocorrencias (AUSENCIAS_OCORRENCIAS)
-- ============================================================
CREATE TABLE ausencias_ocorrencias (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  tipo           text,                          -- ATESTADO | FALTA | OCORRENCIA
  data           date,
  detalhe        text,
  criado_em      timestamptz DEFAULT now()
);

-- ============================================================
-- TABELA: desligamentos_agendados (_deslAgendados localStorage)
-- ============================================================
CREATE TABLE desligamentos_agendados (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  colaborador_id       uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  data_desligamento    date NOT NULL,
  lembrete_enviado     boolean DEFAULT false,
  lembrete_enviado_em  timestamptz,
  criado_em            timestamptz DEFAULT now()
);

-- ============================================================
-- TABELA: log_eventos (LOG_AUTOMACAO_RH + auditoria geral)
-- ============================================================
CREATE TABLE log_eventos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = evento global
  tipo       text NOT NULL,       -- ADMISSAO | DESLIGAMENTO | FERIAS | LOGIN | etc.
  descricao  text,
  dados      jsonb DEFAULT '{}',
  usuario_id uuid REFERENCES auth.users(id),
  criado_em  timestamptz DEFAULT now()
);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX idx_colaboradores_tenant   ON colaboradores(tenant_id);
CREATE INDEX idx_colaboradores_email    ON colaboradores(email_corporativo);
CREATE INDEX idx_colaboradores_status   ON colaboradores(tenant_id, status);
CREATE INDEX idx_ferias_saldo_colab     ON ferias_saldo(colaborador_id);
CREATE INDEX idx_sol_ferias_tenant      ON solicitacoes_ferias(tenant_id);
CREATE INDEX idx_sol_ferias_colab       ON solicitacoes_ferias(colaborador_id);
CREATE INDEX idx_sol_ferias_status      ON solicitacoes_ferias(status);
CREATE INDEX idx_profiles_tenant        ON profiles(tenant_id);
CREATE INDEX idx_profiles_email         ON profiles(email);
CREATE INDEX idx_log_tenant             ON log_eventos(tenant_id, criado_em DESC);
CREATE INDEX idx_desl_agendados_data    ON desligamentos_agendados(data_desligamento, lembrete_enviado);

-- ============================================================
-- FUNÇÃO: atualiza campo atualizado_em automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de atualizado_em
CREATE TRIGGER trg_tenants_updated     BEFORE UPDATE ON tenants     FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
CREATE TRIGGER trg_profiles_updated    BEFORE UPDATE ON profiles     FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
CREATE TRIGGER trg_colaboradores_updated BEFORE UPDATE ON colaboradores FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
CREATE TRIGGER trg_ferias_saldo_updated  BEFORE UPDATE ON ferias_saldo  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
CREATE TRIGGER trg_exames_updated      BEFORE UPDATE ON exames_ocupacionais FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
