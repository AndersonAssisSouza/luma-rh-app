-- ============================================================
-- MIGRATION 009: ausencias_ocorrencias — CID, observação e anexo
-- ============================================================

ALTER TABLE ausencias_ocorrencias
  ADD COLUMN IF NOT EXISTS cid        text,          -- Código CID-10 (ex: J00, M54.5)
  ADD COLUMN IF NOT EXISTS observacao text,          -- Descrição do CID + observações
  ADD COLUMN IF NOT EXISTS anexo_url  text;          -- URL do atestado/laudo no Storage

-- Índice para facilitar filtros por CID
CREATE INDEX IF NOT EXISTS idx_ausencias_cid ON ausencias_ocorrencias(cid);

-- Storage bucket para atestados (executar uma vez via Dashboard ou abaixo)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('atestados', 'atestados', false)
-- ON CONFLICT (id) DO NOTHING;

-- RLS para atestados no storage: tenant isola por pasta colaborador_id/
-- (configurar via Cloudflare Pages ou Dashboard do Supabase Storage)
