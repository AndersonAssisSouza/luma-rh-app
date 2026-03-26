-- ============================================================
-- LUMA RH — Migration 003: Triggers de Auditoria
-- Registra automaticamente INSERT/UPDATE/DELETE em log_eventos
-- ============================================================

-- ============================================================
-- FUNÇÃO: registra evento de auditoria genérico
-- ============================================================
CREATE OR REPLACE FUNCTION _audit_log()
RETURNS TRIGGER AS $$
DECLARE
  _tenant_id uuid;
  _tipo      text;
  _dados     jsonb;
BEGIN
  -- Determina tenant_id baseado na tabela
  IF TG_OP = 'DELETE' THEN
    _tenant_id := OLD.tenant_id;
    _dados := to_jsonb(OLD);
  ELSE
    _tenant_id := NEW.tenant_id;
    _dados := to_jsonb(NEW);
  END IF;

  -- Tipo de evento: TABELA_OPERACAO
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
-- TRIGGERS DE AUDITORIA
-- ============================================================
CREATE TRIGGER audit_colaboradores
  AFTER INSERT OR UPDATE OR DELETE ON colaboradores
  FOR EACH ROW EXECUTE FUNCTION _audit_log();

CREATE TRIGGER audit_sol_ferias
  AFTER INSERT OR UPDATE OR DELETE ON solicitacoes_ferias
  FOR EACH ROW EXECUTE FUNCTION _audit_log();

CREATE TRIGGER audit_desl_agendados
  AFTER INSERT OR UPDATE OR DELETE ON desligamentos_agendados
  FOR EACH ROW EXECUTE FUNCTION _audit_log();

-- ============================================================
-- FUNÇÃO: cria profile automaticamente ao criar auth.user
-- Chamada via Supabase Database Webhook (Auth Hook)
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nome, email, role, tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'colaborador'),
    CASE
      WHEN NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'tenant_id')::uuid
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger no schema auth (requer permissão de superuser no Supabase)
-- Executar manualmente no SQL Editor do Supabase:
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- FUNÇÃO: auto-gera ID_COLABORADOR sequencial por tenant
-- ============================================================
CREATE OR REPLACE FUNCTION gen_id_colaborador(p_tenant_id uuid)
RETURNS text AS $$
DECLARE
  _last integer;
BEGIN
  SELECT COALESCE(
    MAX(CAST(REPLACE(id_colaborador, 'COL-', '') AS integer)),
    0
  ) INTO _last
  FROM colaboradores
  WHERE tenant_id = p_tenant_id
    AND id_colaborador ~ '^COL-[0-9]+$';

  RETURN 'COL-' || LPAD((_last + 1)::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNÇÃO: valida saldo de férias antes de inserir solicitação
-- ============================================================
CREATE OR REPLACE FUNCTION check_saldo_ferias()
RETURNS TRIGGER AS $$
DECLARE
  _vinculo text;
  _usados  integer;
  _saldo   integer;
BEGIN
  -- Busca vínculo do colaborador
  SELECT tipo_vinculo INTO _vinculo
  FROM colaboradores WHERE id = NEW.colaborador_id;

  -- PJ/MEI: sem validação de saldo
  IF _vinculo IN ('PJ', 'MEI') THEN RETURN NEW; END IF;

  -- Soma dias já usados (excluindo rejeitados)
  SELECT COALESCE(SUM(dias_corridos), 0) INTO _usados
  FROM solicitacoes_ferias
  WHERE colaborador_id = NEW.colaborador_id
    AND status != 'REJEITADO'
    AND id != NEW.id;

  _saldo := GREATEST(0, 30 - _usados);

  IF NEW.dias_corridos > _saldo THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: % dias', _saldo;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_saldo_ferias
  BEFORE INSERT OR UPDATE ON solicitacoes_ferias
  FOR EACH ROW EXECUTE FUNCTION check_saldo_ferias();

-- ============================================================
-- LIMPEZA: remover logs com mais de 1 ano (manutenção)
-- Executar via pg_cron ou manualmente
-- ============================================================
-- SELECT cron.schedule('cleanup-logs', '0 3 * * 0',
--   'DELETE FROM log_eventos WHERE criado_em < now() - interval ''1 year''');
