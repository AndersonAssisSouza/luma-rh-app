-- ── Exames: coluna de data de agendamento ──────────────────────────

ALTER TABLE public.exames_ocupacionais
  ADD COLUMN IF NOT EXISTS data_agendamento date;

-- Status possíveis após esta migration:
--   PENDENTE                → exame vencido/próximo, sem agendamento
--   AGENDADO                → data_agendamento preenchida, exame marcado
--   AGUARDANDO_CONFIRMACAO  → data_agendamento passou, aguardando confirmação de realização
--   EM_DIA                  → exame realizado e confirmado
--   VENCIDO                 → passou do prazo sem realização
