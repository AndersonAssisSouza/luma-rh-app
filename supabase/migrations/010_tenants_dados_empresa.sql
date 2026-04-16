-- ============================================================
-- MIGRATION 010: tenants — dados complementares da empresa
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS email_financeiro text,
  ADD COLUMN IF NOT EXISTS email_rh         text,
  ADD COLUMN IF NOT EXISTS cnpj             text,
  ADD COLUMN IF NOT EXISTS telefone         text,
  ADD COLUMN IF NOT EXISTS endereco         text;

COMMENT ON COLUMN tenants.email_financeiro IS 'E-mail do setor financeiro — recebe relatório mensal de ausências';
COMMENT ON COLUMN tenants.email_rh         IS 'E-mail do setor de RH';
COMMENT ON COLUMN tenants.cnpj             IS 'CNPJ da empresa';
COMMENT ON COLUMN tenants.telefone         IS 'Telefone de contato da empresa';
COMMENT ON COLUMN tenants.endereco         IS 'Endereço completo da empresa';
