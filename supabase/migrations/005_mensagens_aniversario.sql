-- ============================================================
-- LUMA RH — Migration 005: Tabela de mensagens de aniversário
-- Armazena templates de mensagens para posts de aniversário
-- de funcionário e aniversário de tempo de empresa
-- ============================================================

CREATE TABLE IF NOT EXISTS mensagens_aniversario (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN ('funcionario', 'empresa')),
  texto         text NOT NULL,
  ativo         boolean DEFAULT true,
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

ALTER TABLE mensagens_aniversario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON mensagens_aniversario
  USING (tenant_id = _my_tenant_id());

CREATE POLICY "manager_global" ON mensagens_aniversario
  USING (_my_role() = 'manager_global');
