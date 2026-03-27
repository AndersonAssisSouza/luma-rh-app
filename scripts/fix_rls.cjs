// fix_rls.cjs — corrige recursão nas funções RLS via Supabase Management API
// Precisa do Personal Access Token do Supabase (Settings → Access Tokens)
const https = require('https');

const PROJECT_REF = 'ttclcdppifmmdjztfunl';
// Se tiver um Personal Access Token, coloque aqui. Caso contrário, use o Dashboard.
const PAT = process.env.SUPABASE_PAT || '';

const SQL = `
CREATE OR REPLACE FUNCTION _my_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION _my_role()
RETURNS text
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION _my_email()
RETURNS text
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM profiles WHERE id = auth.uid()
$$;
`;

if (!PAT) {
  console.log('\n=== SQL PARA EXECUTAR NO SUPABASE DASHBOARD ===');
  console.log('Acesse: https://supabase.com/dashboard/project/' + PROJECT_REF + '/sql/new');
  console.log('\nCole e execute o seguinte SQL:\n');
  console.log(SQL);
  process.exit(0);
}

// Se tiver PAT, executa via API
const body = JSON.stringify({ query: SQL });
const req = https.request({
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${PAT}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✓ Funções RLS corrigidas com sucesso!');
    } else {
      console.error('Erro HTTP', res.statusCode, data);
    }
  });
});
req.on('error', e => console.error('Erro:', e.message));
req.write(body);
req.end();
