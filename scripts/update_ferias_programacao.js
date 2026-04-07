// Script: Atualiza ferias_saldo com dados do PDF "Programação de Férias"
// Execução: node scripts/update_ferias_programacao.js
// Caio Di Cesare foi desligado em 07/04/2026 — NÃO incluído

const SUPABASE_URL = 'https://ttclcdppifmmdjztfunl.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Y2xjZHBwaWZtbWRqenRmdW5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUzNjg4OCwiZXhwIjoyMDkwMTEyODg4fQ.OGYi5aNnXIyZdQbK3I7e-_GICcClzHd9G2hZZS0dx1g'

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

// Dados do PDF (período 1 = período atual/mais recente)
// formato: { busca: string parcial do nome (ilike), inicio, fim, limite, status }
const DADOS_PDF = [
  {
    busca: 'julimaira',
    inicio: '2025-05-06', fim: '2025-12-21', limite: '2026-12-14',
    status: 'NAO_PROGRAMADA'
  },
  {
    busca: 'karla silva',
    inicio: '2025-05-05', fim: '2025-12-21', limite: '2026-12-14',
    status: 'NAO_PROGRAMADA'
  },
  {
    busca: 'varley',
    inicio: '2025-07-15', fim: '2025-12-21', limite: '2026-12-21',
    status: 'NAO_PROGRAMADA'
  },
  {
    busca: 'victor machado',
    inicio: '2025-03-17', fim: '2025-12-21', limite: '2026-12-11',
    status: 'NAO_PROGRAMADA'
  },
  {
    busca: 'victor assump',
    inicio: '2025-09-16', fim: '2026-09-15', limite: '2027-08-17',
    status: 'NAO_PROGRAMADA'
  },
  {
    busca: 'laissa',
    inicio: '2025-10-27', fim: '2026-10-26', limite: '2027-09-27',
    status: 'NAO_PROGRAMADA'
  },
  {
    busca: 'matheus fernandes',
    inicio: '2025-10-27', fim: '2026-10-26', limite: '2027-09-27',
    status: 'NAO_PROGRAMADA'
  },
  {
    busca: 'paulo roberto pereira',
    inicio: '2026-03-02', fim: '2027-03-01', limite: '2028-02-01',
    status: 'NAO_PROGRAMADA'
  },
]

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function sbUpsert(table, data, onConflict='tenant_id,colaborador_id') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error(`UPSERT ${table} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function main() {
  // 1. Busca tenant_id
  const tenants = await sbGet('tenants?slug=eq.luisa-moraes-advogados&select=id,nome')
  if (!tenants.length) {
    // Tenta sem slug específico
    const all = await sbGet('tenants?select=id,nome,slug')
    console.log('Tenants disponíveis:', all.map(t => `${t.slug} (${t.id})`).join(', '))
    process.exit(1)
  }
  const tenantId = tenants[0].id
  console.log(`✅ Tenant: ${tenants[0].nome} (${tenantId})`)

  // 2. Processa cada funcionário
  for (const dado of DADOS_PDF) {
    // Busca colaborador por nome (ilike)
    const colabs = await sbGet(
      `colaboradores?tenant_id=eq.${tenantId}&nome=ilike.*${encodeURIComponent(dado.busca)}*&select=id,nome,status`
    )

    if (!colabs.length) {
      console.warn(`⚠️  Não encontrado: "${dado.busca}"`)
      continue
    }
    if (colabs.length > 1) {
      console.warn(`⚠️  Múltiplos resultados para "${dado.busca}": ${colabs.map(c=>c.nome).join(', ')} — usando o primeiro`)
    }

    const colab = colabs[0]
    console.log(`\n👤 ${colab.nome} (${colab.status})`)

    // Upsert ferias_saldo
    const record = {
      tenant_id:                tenantId,
      colaborador_id:           colab.id,
      inicio_periodo_aquisitivo: dado.inicio,
      fim_periodo_aquisitivo:    dado.fim,
      fim_periodo_concessivo:    dado.limite,
      status_ferias:             dado.status
    }

    const result = await sbUpsert('ferias_saldo', record)
    console.log(`   ✅ ferias_saldo atualizado: ${dado.inicio} → ${dado.fim} (limite: ${dado.limite})`)
  }

  console.log('\n🎉 Concluído!')
}

main().catch(err => {
  console.error('❌ Erro:', err.message)
  process.exit(1)
})
