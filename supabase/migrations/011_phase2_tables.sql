-- ── Fase 2: Tabelas para Admin Console ──────────────────────────

-- Faturas (Stripe-ready)
CREATE TABLE IF NOT EXISTS public.invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  descricao        text,
  valor            numeric(12,2) NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'PENDENTE', -- PENDENTE, PAGO, VENCIDO, CANCELADO
  stripe_invoice_id text,
  stripe_charge_id  text,
  vencimento       date,
  pago_em          timestamptz,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_global_invoices" ON public.invoices
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager_global'));

-- Anotações de tenant
CREATE TABLE IF NOT EXISTS public.tenant_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nota        text NOT NULL,
  criado_por  text,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_global_notes" ON public.tenant_notes
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager_global'));
