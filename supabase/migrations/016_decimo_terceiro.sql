-- ── 13° Salário — Lei 4.090/62 ───────────────────────────────────────
-- Obrigatório para CLT. Duas parcelas anuais:
--   1ª parcela: entre 1° fev e 30 nov (50% do salário bruto do mês anterior)
--   2ª parcela: até 20 de dezembro (saldo, descontados INSS e IRRF)

CREATE TABLE IF NOT EXISTS public.decimo_terceiro (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  colaborador_id   uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  ano              integer NOT NULL,
  parcela          integer NOT NULL CHECK (parcela IN (1, 2)),
  meses_trabalhados integer,        -- avos (1–12); NULL = ano completo
  valor_bruto      numeric(12,2),
  inss_desconto    numeric(12,2),
  irrf_desconto    numeric(12,2),
  valor_liquido    numeric(12,2),
  data_pagamento   date,
  status           text NOT NULL DEFAULT 'PENDENTE',  -- PENDENTE | PAGO | ADIANTADO_FERIAS
  observacao       text,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz DEFAULT now(),
  UNIQUE (colaborador_id, ano, parcela)
);

ALTER TABLE public.decimo_terceiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_decimo" ON public.decimo_terceiro
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "manager_global_decimo" ON public.decimo_terceiro
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager_global'));

CREATE INDEX IF NOT EXISTS idx_decimo_colab_ano
  ON public.decimo_terceiro (colaborador_id, ano, parcela);
