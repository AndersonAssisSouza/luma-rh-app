// setup_storage.cjs — cria bucket luma-rh-assets no Supabase Storage
const SB_URL = 'https://ttclcdppifmmdjztfunl.supabase.co';
const SB_SVC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Y2xjZHBwaWZtbWRqenRmdW5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUzNjg4OCwiZXhwIjoyMDkwMTEyODg4fQ.OGYi5aNnXIyZdQbK3I7e-_GICcClzHd9G2hZZS0dx1g';

const HDR = { 'Content-Type': 'application/json', Authorization: `Bearer ${SB_SVC}`, apikey: SB_SVC };

async function run() {
  // 1. Cria bucket
  const r1 = await fetch(`${SB_URL}/storage/v1/bucket`, {
    method: 'POST', headers: HDR,
    body: JSON.stringify({
      id: 'luma-rh-assets', name: 'luma-rh-assets', public: true,
      file_size_limit: 3145728,
      allowed_mime_types: ['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
    })
  });
  const b1 = await r1.text();
  console.log('Bucket:', r1.status, b1.slice(0,80));

  // 2. Políticas de storage via SQL
  const sql = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='auth_upload' AND tablename='objects' AND schemaname='storage') THEN
    CREATE POLICY "auth_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'luma-rh-assets');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='auth_update' AND tablename='objects' AND schemaname='storage') THEN
    CREATE POLICY "auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'luma-rh-assets');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='auth_delete' AND tablename='objects' AND schemaname='storage') THEN
    CREATE POLICY "auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'luma-rh-assets');
  END IF;
END $$;`;

  const r2 = await fetch(`${SB_URL}/rest/v1/rpc/query`, {
    method: 'POST', headers: HDR, body: JSON.stringify({ query: sql })
  });
  console.log('Policies (via rpc):', r2.status);

  // Fallback: via pg endpoint
  const r3 = await fetch(`${SB_URL}/pg`, {
    method: 'POST', headers: HDR, body: JSON.stringify({ query: sql })
  });
  console.log('Policies (via pg):', r3.status, (await r3.text()).slice(0,60));

  console.log('\n✅ Setup concluído! Bucket luma-rh-assets criado.');
}

run().catch(e => console.error('Erro:', e.message));
