const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function run() {
  console.log('Aplicando migration 009: CID + observacao + anexo_url...')

  // Adicionar colunas via raw SQL usando rpc ou insert direto
  // Como não temos exec_sql, usamos fetch direto ao pg-meta ou REST
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
    method: 'GET',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
    }
  })

  // Verificar colunas atuais
  const { data: sample, error: e1 } = await sb
    .from('ausencias_ocorrencias')
    .select('id, cid, observacao, anexo_url')
    .limit(1)

  if (!e1) {
    console.log('✅ Colunas já existem! Migration já aplicada.')
    return
  }

  console.log('Colunas não encontradas, tentando criar...')
  console.log('ATENÇÃO: Execute manualmente no Supabase SQL Editor:')
  console.log(`
ALTER TABLE ausencias_ocorrencias
  ADD COLUMN IF NOT EXISTS cid        text,
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS anexo_url  text;

CREATE INDEX IF NOT EXISTS idx_ausencias_cid ON ausencias_ocorrencias(cid);

-- Criar bucket de atestados no Storage (também via Dashboard → Storage → New bucket)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('atestados', 'atestados', false, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Policy: usuário autenticado do mesmo tenant pode fazer upload
CREATE POLICY "atestados_upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'atestados');

CREATE POLICY "atestados_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'atestados');
  `)
}

run().catch(console.error)
