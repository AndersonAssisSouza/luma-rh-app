-- ============================================================
-- LUMA RH — SETUP COMPLETO (001 + 002 + 003)
-- Cole TODO este arquivo no Supabase SQL Editor e clique RUN
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABELAS
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  slug          text UNIQUE NOT NULL,
  email_admin   text NOT NULL,
  plano         text NOT NULL DEFAULT 'TRIAL',
  status        text NOT NULL DEFAULT 'ATIVO',
  max_usuarios  integer DEFAULT 10,
  config        jsonb DEFAULT '{}',
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id     uuid REFERENCES tenants(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  email         text NOT NULL UNIQUE,
  role          text NOT NULL DEFAULT 'colaborador',
  status        text NOT NULL DEFAULT 'ATIVO',
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS colaboradores (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id_colaborador        text NOT NULL,
  nome                  text NOT NULL,
  email_corporativo     text,
  tipo_vinculo          text,
  status                text DEFAULT 'ATIVO',
  data_nascimento       date,
  data_admissao         date,
  data_desligamento     date,
  cargo                 text,
  area                  text,
  setor                 text,
  gestor                text,
  gestor_email          text,
  empresa               text,
  contrato_indeterminado boolean DEFAULT false,
  tempo_experiencia     integer,
  salario_honorario     numeric(12,2),
  vale_refeicao         numeric(12,2),
  vale_transporte       numeric(12,2),
  plano_saude           text,
  outros_beneficios     text,
  criado_em             timestamptz DEFAULT now(),
  atualizado_em         timestamptz DEFAULT now(),
  UNIQUE (tenant_id, id_colaborador)
);

CREATE TABLE IF NOT EXISTS ferias_saldo (
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
  criado_em                 timestamptz DEFAULT now(),
  atualizado_em             timestamptz DEFAULT now(),
  UNIQUE (tenant_id, colaborador_id)
);

CREATE TABLE IF NOT EXISTS solicitacoes_ferias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  colaborador_id  uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  protocolo       text UNIQUE NOT NULL,
  data_inicio     date NOT NULL,
  data_fim        date NOT NULL,
  dias_corridos   integer NOT NULL,
  dias_uteis      integer,
  observacao      text,
  status          text NOT NULL DEFAULT 'PENDENTE',
  motivo_rejeicao text,
  solicitado_em   timestamptz DEFAULT now(),
  decisao_em      timestamptz,
  criado_em       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exames_ocupacionais (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  tipo_exame     text,
  ultimo_exame   date,
  proximo_exame  date,
  status_exame   text,
  observacao     text,
  criado_em      timestamptz DEFAULT now(),
  atualizado_em  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ausencias_ocorrencias (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  tipo           text,
  data           date,
  detalhe        text,
  criado_em      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS desligamentos_agendados (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  colaborador_id       uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  data_desligamento    date NOT NULL,
  lembrete_enviado     boolean DEFAULT false,
  lembrete_enviado_em  timestamptz,
  criado_em            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS log_eventos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid REFERENCES tenants(id) ON DELETE CASCADE,
  tipo       text NOT NULL,
  descricao  text,
  dados      jsonb DEFAULT '{}',
  usuario_id uuid REFERENCES auth.users(id),
  criado_em  timestamptz DEFAULT now()
);

-- ============================================================
-- INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_colaboradores_tenant  ON colaboradores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_email   ON colaboradores(email_corporativo);
CREATE INDEX IF NOT EXISTS idx_colaboradores_status  ON colaboradores(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ferias_saldo_colab    ON ferias_saldo(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_sol_ferias_tenant     ON solicitacoes_ferias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sol_ferias_colab      ON solicitacoes_ferias(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_sol_ferias_status     ON solicitacoes_ferias(status);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant       ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email        ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_log_tenant            ON log_eventos(tenant_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_desl_agendados_data   ON desligamentos_agendados(data_desligamento, lembrete_enviado);

-- ============================================================
-- FUNCOES
-- ============================================================
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION _my_tenant_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION _my_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION _my_email()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT email FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION gen_id_colaborador(p_tenant_id uuid)
RETURNS text AS $$
DECLARE _last integer;
BEGIN
  SELECT COALESCE(MAX(CAST(REPLACE(id_colaborador,'COL-','') AS integer)),0)
  INTO _last FROM colaboradores
  WHERE tenant_id = p_tenant_id AND id_colaborador ~ '^COL-[0-9]+$';
  RETURN 'COL-' || LPAD((_last+1)::text,3,'0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nome, email, role, tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role','colaborador'),
    CASE WHEN NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL
         THEN (NEW.raw_user_meta_data->>'tenant_id')::uuid ELSE NULL END
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION _audit_log()
RETURNS TRIGGER AS $$
DECLARE _tenant_id uuid; _dados jsonb;
BEGIN
  IF TG_OP='DELETE' THEN _tenant_id:=OLD.tenant_id; _dados:=to_jsonb(OLD);
  ELSE _tenant_id:=NEW.tenant_id; _dados:=to_jsonb(NEW); END IF;
  INSERT INTO log_eventos(tenant_id,tipo,descricao,dados,usuario_id)
  VALUES(_tenant_id,TG_TABLE_NAME||'_'||TG_OP,TG_OP||' em '||TG_TABLE_NAME,_dados,auth.uid());
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_saldo_ferias()
RETURNS TRIGGER AS $$
DECLARE _vinculo text; _usados integer; _saldo integer;
BEGIN
  SELECT tipo_vinculo INTO _vinculo FROM colaboradores WHERE id=NEW.colaborador_id;
  IF _vinculo IN ('PJ','MEI') THEN RETURN NEW; END IF;
  SELECT COALESCE(SUM(dias_corridos),0) INTO _usados
  FROM solicitacoes_ferias
  WHERE colaborador_id=NEW.colaborador_id AND status!='REJEITADO' AND id!=NEW.id;
  _saldo := GREATEST(0,30-_usados);
  IF NEW.dias_corridos > _saldo THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponivel: % dias', _saldo;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS trg_tenants_updated        ON tenants;
DROP TRIGGER IF EXISTS trg_profiles_updated       ON profiles;
DROP TRIGGER IF EXISTS trg_colaboradores_updated  ON colaboradores;
DROP TRIGGER IF EXISTS trg_ferias_saldo_updated   ON ferias_saldo;
DROP TRIGGER IF EXISTS trg_exames_updated         ON exames_ocupacionais;
DROP TRIGGER IF EXISTS on_auth_user_created       ON auth.users;
DROP TRIGGER IF EXISTS audit_colaboradores        ON colaboradores;
DROP TRIGGER IF EXISTS audit_sol_ferias           ON solicitacoes_ferias;
DROP TRIGGER IF EXISTS audit_desl_agendados       ON desligamentos_agendados;
DROP TRIGGER IF EXISTS trg_check_saldo_ferias     ON solicitacoes_ferias;

CREATE TRIGGER trg_tenants_updated       BEFORE UPDATE ON tenants              FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
CREATE TRIGGER trg_profiles_updated      BEFORE UPDATE ON profiles             FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
CREATE TRIGGER trg_colaboradores_updated BEFORE UPDATE ON colaboradores        FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
CREATE TRIGGER trg_ferias_saldo_updated  BEFORE UPDATE ON ferias_saldo         FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
CREATE TRIGGER trg_exames_updated        BEFORE UPDATE ON exames_ocupacionais  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
CREATE TRIGGER on_auth_user_created      AFTER  INSERT ON auth.users           FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER audit_colaboradores       AFTER INSERT OR UPDATE OR DELETE ON colaboradores             FOR EACH ROW EXECUTE FUNCTION _audit_log();
CREATE TRIGGER audit_sol_ferias          AFTER INSERT OR UPDATE OR DELETE ON solicitacoes_ferias       FOR EACH ROW EXECUTE FUNCTION _audit_log();
CREATE TRIGGER audit_desl_agendados      AFTER INSERT OR UPDATE OR DELETE ON desligamentos_agendados   FOR EACH ROW EXECUTE FUNCTION _audit_log();
CREATE TRIGGER trg_check_saldo_ferias    BEFORE INSERT OR UPDATE            ON solicitacoes_ferias     FOR EACH ROW EXECUTE FUNCTION check_saldo_ferias();

-- ============================================================
-- RLS
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

DROP POLICY IF EXISTS "tenants_manager_global"   ON tenants;
DROP POLICY IF EXISTS "profiles_select"          ON profiles;
DROP POLICY IF EXISTS "profiles_insert"          ON profiles;
DROP POLICY IF EXISTS "profiles_update"          ON profiles;
DROP POLICY IF EXISTS "profiles_delete"          ON profiles;
DROP POLICY IF EXISTS "colaboradores_select"     ON colaboradores;
DROP POLICY IF EXISTS "colaboradores_insert"     ON colaboradores;
DROP POLICY IF EXISTS "colaboradores_update"     ON colaboradores;
DROP POLICY IF EXISTS "colaboradores_delete"     ON colaboradores;
DROP POLICY IF EXISTS "ferias_saldo_select"      ON ferias_saldo;
DROP POLICY IF EXISTS "ferias_saldo_write"       ON ferias_saldo;
DROP POLICY IF EXISTS "sol_ferias_select"        ON solicitacoes_ferias;
DROP POLICY IF EXISTS "sol_ferias_insert"        ON solicitacoes_ferias;
DROP POLICY IF EXISTS "sol_ferias_update"        ON solicitacoes_ferias;
DROP POLICY IF EXISTS "exames_all"               ON exames_ocupacionais;
DROP POLICY IF EXISTS "ausencias_all"            ON ausencias_ocorrencias;
DROP POLICY IF EXISTS "desl_agendados_all"       ON desligamentos_agendados;
DROP POLICY IF EXISTS "log_select"               ON log_eventos;
DROP POLICY IF EXISTS "log_insert"               ON log_eventos;

CREATE POLICY "tenants_manager_global" ON tenants FOR ALL USING (_my_role()='manager_global');
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (_my_role()='manager_global' OR id=auth.uid() OR tenant_id=_my_tenant_id());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (_my_role()='manager_global' OR (tenant_id=_my_tenant_id() AND _my_role()='master'));
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (_my_role()='manager_global' OR id=auth.uid() OR (tenant_id=_my_tenant_id() AND _my_role()='master'));
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING ((_my_role()='manager_global' OR (tenant_id=_my_tenant_id() AND _my_role()='master')) AND id!=auth.uid());
CREATE POLICY "colaboradores_select" ON colaboradores FOR SELECT USING (_my_role()='manager_global' OR (tenant_id=_my_tenant_id() AND (_my_role() IN ('master','rh') OR gestor_email=_my_email() OR email_corporativo=_my_email())));
CREATE POLICY "colaboradores_insert" ON colaboradores FOR INSERT WITH CHECK (_my_role()='manager_global' OR (tenant_id=_my_tenant_id() AND _my_role() IN ('master','rh')));
CREATE POLICY "colaboradores_update" ON colaboradores FOR UPDATE USING (_my_role()='manager_global' OR (tenant_id=_my_tenant_id() AND _my_role() IN ('master','rh')) OR (tenant_id=_my_tenant_id() AND gestor_email=_my_email() AND _my_role()='gestor'));
CREATE POLICY "colaboradores_delete" ON colaboradores FOR DELETE USING (_my_role()='manager_global' OR (tenant_id=_my_tenant_id() AND _my_role()='master'));
CREATE POLICY "ferias_saldo_select" ON ferias_saldo FOR SELECT USING (_my_role()='manager_global' OR (tenant_id=_my_tenant_id() AND (_my_role() IN ('master','rh','gestor') OR colaborador_id IN (SELECT id FROM colaboradores WHERE email_corporativo=_my_email()))));
CREATE POLICY "ferias_saldo_write"  ON ferias_saldo FOR ALL   USING (_my_role()='manager_global' OR (tenant_id=_my_tenant_id() AND _my_role() IN ('master','rh')));
CREATE POLICY "sol_ferias_select" ON solicitacoes_ferias FOR SELECT USING (_my_role()='manager_global' OR (tenant_id=_my_tenant_id() AND (_my_role() IN ('master','rh','gestor') OR colaborador_id IN (SELECT id FROM colaboradores WHERE email_corporativo=_my_email()))));
CREATE POLICY "sol_ferias_insert" ON solicitacoes_ferias FOR INSERT WITH CHECK (_my_role()='manager_global' OR (tenant_id=_my_tenant_id() AND (_my_role() IN ('master','rh') OR colaborador_id IN (SELECT id FROM colaboradores WHERE email_corporativo=_my_email()))));
CREATE POLICY "sol_ferias_update" ON solicitacoes_ferias FOR UPDATE USING (_my_role()='manager_global' OR (tenant_id=_my_tenant_id() AND _my_role() IN ('master','rh','gestor')));
CREATE POLICY "exames_all"        ON exames_ocupacionais     FOR ALL USING (_my_role()='manager_global' OR (tenant_id=_my_tenant_id() AND _my_role() IN ('master','rh','gestor')));
CREATE POLICY "ausencias_all"     ON ausencias_ocorrencias   FOR ALL USING (_my_role()='manager_global' OR (tenant_id=_my_tenant_id() AND _my_role() IN ('master','rh','gestor')));
CREATE POLICY "desl_agendados_all" ON desligamentos_agendados FOR ALL USING (_my_role()='manager_global' OR (tenant_id=_my_tenant_id() AND _my_role() IN ('master','rh')));
CREATE POLICY "log_select" ON log_eventos FOR SELECT USING (_my_role()='manager_global' OR tenant_id=_my_tenant_id());
CREATE POLICY "log_insert" ON log_eventos FOR INSERT WITH CHECK (_my_role()='manager_global' OR tenant_id=_my_tenant_id() OR tenant_id IS NULL);

-- VIEWS
CREATE OR REPLACE VIEW v_colaboradores_sem_financeiro WITH (security_invoker=true) AS
SELECT id,tenant_id,id_colaborador,nome,email_corporativo,tipo_vinculo,status,
  data_nascimento,data_admissao,data_desligamento,cargo,area,setor,gestor,
  gestor_email,empresa,contrato_indeterminado,tempo_experiencia,
  plano_saude,outros_beneficios,criado_em,atualizado_em
FROM colaboradores;

CREATE OR REPLACE VIEW v_colaboradores_financeiro WITH (security_invoker=true) AS
SELECT * FROM colaboradores WHERE _my_role() IN ('master','rh','manager_global');

-- FIM DO SETUP
