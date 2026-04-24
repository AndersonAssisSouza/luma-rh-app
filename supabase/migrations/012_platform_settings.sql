-- ── Fase 2: Configurações globais da plataforma ────────────────────

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave       text UNIQUE NOT NULL,
  valor       jsonb NOT NULL DEFAULT '{}',
  descricao   text,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_global_settings" ON public.platform_settings
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager_global'));

-- Valores padrão
INSERT INTO public.platform_settings (chave, valor, descricao) VALUES
  ('politicas', '{"trialDias":30,"maxUsuariosBasico":10,"maxUsuariosPro":50,"maxUsuariosEnterprise":200}', 'Políticas de planos e limites'),
  ('notificacoes', '{"emailDesligamento":true,"emailExame":true,"emailFerias":true,"emailFatura":true,"diasAntecedenciaDesligamento":7,"diasAntecedenciaExame":30,"diasAntecedenciaFerias":30}', 'Configurações de notificações automáticas')
ON CONFLICT (chave) DO NOTHING;
