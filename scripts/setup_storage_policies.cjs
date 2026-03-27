// setup_storage_policies.cjs — cria políticas RLS para o bucket luma-rh-assets
// Executa via Management API (requer token do dashboard ou PAT)
const SB_URL = 'https://ttclcdppifmmdjztfunl.supabase.co';
const SB_SVC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Y2xjZHBwaWZtbWRqenRmdW5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUzNjg4OCwiZXhwIjoyMDkwMTEyODg4fQ.OGYi5aNnXIyZdQbK3I7e-_GICcClzHd9G2hZZS0dx1g';

// Usa Management API com PAT ou SUPABASE_ACCESS_TOKEN do ambiente
const PAT = process.env.SUPABASE_ACCESS_TOKEN || '';

async function run() {
  if (!PAT) {
    console.log('\n⚠️  SUPABASE_ACCESS_TOKEN não definido.');
    console.log('Acesse o Supabase Dashboard → Storage → Policies e adicione manualmente:');
    console.log('\nPolicies para bucket "luma-rh-assets":');
    console.log('  INSERT: TO authenticated WITH CHECK (bucket_id = \'luma-rh-assets\')');
    console.log('  UPDATE: TO authenticated USING (bucket_id = \'luma-rh-assets\')');
    console.log('  DELETE: TO authenticated USING (bucket_id = \'luma-rh-assets\')');
    console.log('\nOU execute no SQL Editor do Supabase:');
    const sql = `
CREATE POLICY "authenticated_can_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'luma-rh-assets');

CREATE POLICY "authenticated_can_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'luma-rh-assets');

CREATE POLICY "authenticated_can_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'luma-rh-assets');`;
    console.log(sql);
    return;
  }

  const sql = `
CREATE POLICY IF NOT EXISTS "authenticated_can_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'luma-rh-assets');

CREATE POLICY IF NOT EXISTS "authenticated_can_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'luma-rh-assets');

CREATE POLICY IF NOT EXISTS "authenticated_can_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'luma-rh-assets');`;

  const res = await fetch(`https://api.supabase.com/v1/projects/ttclcdppifmmdjztfunl/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  console.log('Status:', res.status, await res.text());
}

run().catch(e => console.error('Erro:', e.message));
