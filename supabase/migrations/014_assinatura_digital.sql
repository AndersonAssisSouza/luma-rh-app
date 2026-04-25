-- ── Feature 9: Assinatura digital nas solicitações de férias ────────

ALTER TABLE public.solicitacoes_ferias
  ADD COLUMN IF NOT EXISTS assinatura_base64 text;

-- Índice parcial para buscar rapidamente solicitações assinadas
CREATE INDEX IF NOT EXISTS idx_solicitacoes_assinadas
  ON public.solicitacoes_ferias (tenant_id, status)
  WHERE assinatura_base64 IS NOT NULL;
