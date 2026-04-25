-- ── Dependentes dos colaboradores ───────────────────────────────────
-- Exigido para: IRRF (dedução R$189,59/dep.), Salário Família, Plano de Saúde

CREATE TABLE IF NOT EXISTS public.dependentes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  colaborador_id   uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  nome             text NOT NULL,
  data_nascimento  date,
  cpf              text,
  grau_parentesco  text NOT NULL DEFAULT 'FILHO',
  -- CONJUGE | FILHO | ENTEADO | PAI | MAE | IRMAO | TUTELADO | OUTRO
  irrf             boolean NOT NULL DEFAULT true,   -- deduz no IRRF
  salario_familia  boolean NOT NULL DEFAULT false,  -- percebe salário família (filhos ≤ 14 anos)
  plano_saude      boolean NOT NULL DEFAULT false,  -- incluso no plano de saúde da empresa
  observacao       text,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz DEFAULT now()
);

ALTER TABLE public.dependentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_dependentes" ON public.dependentes
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "manager_global_dependentes" ON public.dependentes
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager_global'));

-- Índice de busca por colaborador
CREATE INDEX IF NOT EXISTS idx_dependentes_colaborador
  ON public.dependentes (colaborador_id, tenant_id);
