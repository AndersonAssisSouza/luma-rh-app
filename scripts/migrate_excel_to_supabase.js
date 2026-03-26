/**
 * LUMA RH — Script de Migração: Excel (OneDrive) → Supabase
 *
 * EXECUTAR NO NODE.JS:
 *   cd scripts
 *   npm install @supabase/supabase-js node-fetch dotenv
 *   node migrate_excel_to_supabase.js
 *
 * PREENCHER AS VARIÁVEIS ABAIXO OU CRIAR .env:
 *   SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY=...  (service_role key — NUNCA expor no frontend)
 *   MS_GRAPH_TOKEN=...        (token Bearer do Microsoft Graph — obter via portal LUMA autenticado)
 *   MS_DRIVE_ID=b!SYzrfr_-...
 *   MS_ITEM_ID=01O2PYW3...
 *   TENANT_NOME=Luisa Moraes Advogados
 *   TENANT_SLUG=luisa-moraes-advogados
 *   TENANT_EMAIL_ADMIN=anderson.assis@lumaplataforma.com.br
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

// ============================================================
// CONFIG
// ============================================================
const SUPABASE_URL         = process.env.SUPABASE_URL         || 'COLE_AQUI'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'COLE_AQUI'
const MS_GRAPH_TOKEN       = process.env.MS_GRAPH_TOKEN       || 'COLE_AQUI'
const MS_DRIVE_ID          = process.env.MS_DRIVE_ID          || 'b!SYzrfr_-hkupnbeS1zKsZmB6CS4c97VMpJmz3oLVkalAzuB5sMOLR7djv69Vlty9'
const MS_ITEM_ID           = process.env.MS_ITEM_ID           || '01O2PYW3EQZTMNB4MN4BB363SUCCHGX7HV'
const TENANT_NOME          = process.env.TENANT_NOME          || 'Luisa Moraes Advogados'
const TENANT_SLUG          = process.env.TENANT_SLUG          || 'luisa-moraes-advogados'
const TENANT_EMAIL_ADMIN   = process.env.TENANT_EMAIL_ADMIN   || 'anderson.assis@lumaplataforma.com.br'

// Supabase com service_role (bypassa RLS para migração)
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ============================================================
// HELPERS
// ============================================================
async function msGraph(path) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${MS_GRAPH_TOKEN}` }
  })
  if (!r.ok) throw new Error(`Graph ${r.status}: ${await r.text()}`)
  return r.json()
}

async function readSheet(sheetName) {
  const driveB = `/drives/${MS_DRIVE_ID}/items/${MS_ITEM_ID}`
  const d = await msGraph(`${driveB}/workbook/worksheets/${encodeURIComponent(sheetName)}/usedRange`)
  const rows = d.values || []
  if (rows.length < 2) return []
  const hdr = rows[0]
  return rows.slice(1).map((row, i) => {
    const o = { _row: i + 2 }
    hdr.forEach((h, j) => { if (h) o[h] = row[j] ?? null })
    return o
  })
}

function log(msg, type = 'info') {
  const icon = { info: '→', ok: '✓', warn: '⚠', error: '✗' }[type] || '·'
  console.log(`  ${icon} ${msg}`)
}

// ============================================================
// MIGRAÇÃO
// ============================================================
async function migrate() {
  console.log('\n══════════════════════════════════════════════')
  console.log('  LUMA RH — Migração Excel → Supabase')
  console.log('══════════════════════════════════════════════\n')

  // ─────────────────────────────────────────────
  // 1. CRIAR TENANT
  // ─────────────────────────────────────────────
  console.log('📦 1. Criando tenant...')
  let tenantId
  const { data: existTenant } = await sb.from('tenants').select('id').eq('slug', TENANT_SLUG).single()
  if (existTenant) {
    tenantId = existTenant.id
    log(`Tenant já existe (id: ${tenantId})`, 'warn')
  } else {
    const { data, error } = await sb.from('tenants').insert({
      nome: TENANT_NOME, slug: TENANT_SLUG, email_admin: TENANT_EMAIL_ADMIN,
      plano: 'PRO', status: 'ATIVO', max_usuarios: 50
    }).select().single()
    if (error) { log('Erro ao criar tenant: ' + error.message, 'error'); process.exit(1) }
    tenantId = data.id
    log(`Tenant criado: ${tenantId}`, 'ok')
  }

  // ─────────────────────────────────────────────
  // 2. LER EXCEL
  // ─────────────────────────────────────────────
  console.log('\n📊 2. Lendo dados do Excel...')
  const [colaboradores, ferias, exames, ausencias] = await Promise.all([
    readSheet('CADASTRO_COLABORADORES').catch(() => []),
    readSheet('FERIAS_CLT').catch(() => []),
    readSheet('EXAMES_OCUPACIONAIS').catch(() => []),
    readSheet('AUSENCIAS_OCORRENCIAS').catch(() => [])
  ])
  log(`Colaboradores: ${colaboradores.length}`, 'ok')
  log(`Férias CLT: ${ferias.length}`, 'ok')
  log(`Exames: ${exames.length}`, 'ok')
  log(`Ausências: ${ausencias.length}`, 'ok')

  // ─────────────────────────────────────────────
  // 3. MIGRAR COLABORADORES
  // ─────────────────────────────────────────────
  console.log('\n👥 3. Migrando colaboradores...')
  const colabMap = {}  // id_colaborador → uuid
  let colabOk = 0, colabErr = 0

  for (const r of colaboradores) {
    if (!r.NOME || !r.ID_COLABORADOR) continue
    const row = {
      tenant_id:             tenantId,
      id_colaborador:        String(r.ID_COLABORADOR),
      nome:                  r.NOME,
      email_corporativo:     r.EMAIL_CORPORATIVO || null,
      tipo_vinculo:          r.TIPO_VINCULO || r.RAW_VINCULO || null,
      status:                r.STATUS === 'DESLIGADO' ? 'DESLIGADO' : (r.STATUS || 'ATIVO'),
      data_nascimento:       r.DATA_NASCIMENTO || null,
      data_admissao:         r.DATA_ADMISSAO || null,
      data_desligamento:     r.DATA_DESLIGAMENTO || null,
      cargo:                 r.CARGO || null,
      area:                  r.AREA || null,
      setor:                 r.SETOR || null,
      gestor:                r.GESTOR || null,
      gestor_email:          r.GESTOR_EMAIL || null,
      empresa:               r.EMPRESA || null,
      contrato_indeterminado: r.CONTRATO_INDETERMINADO === 'SIM',
      tempo_experiencia:     r.TEMPO_EXPERIENCIA ? parseInt(r.TEMPO_EXPERIENCIA) : null,
      salario_honorario:     r.SALARIO_HONORARIO ? parseFloat(r.SALARIO_HONORARIO) : null,
      vale_refeicao:         r.VALE_REFEICAO ? parseFloat(r.VALE_REFEICAO) : null,
      vale_transporte:       r.VALE_TRANSPORTE ? parseFloat(r.VALE_TRANSPORTE) : null,
      plano_saude:           r.PLANO_SAUDE || null,
      outros_beneficios:     r.OUTROS_BENEFICIOS || null
    }
    const { data, error } = await sb.from('colaboradores')
      .upsert(row, { onConflict: 'tenant_id,id_colaborador' })
      .select('id').single()
    if (error) {
      log(`Erro ${r.NOME}: ${error.message}`, 'error')
      colabErr++
    } else {
      colabMap[r.ID_COLABORADOR] = data.id
      colabOk++
    }
  }
  log(`Migrados: ${colabOk} · Erros: ${colabErr}`, colabErr > 0 ? 'warn' : 'ok')

  // ─────────────────────────────────────────────
  // 4. MIGRAR FÉRIAS
  // ─────────────────────────────────────────────
  console.log('\n🏖  4. Migrando saldo de férias...')
  let ferOk = 0, ferErr = 0

  for (const r of ferias) {
    const colabId = colabMap[r.ID_COLABORADOR]
    if (!colabId) continue
    const { error } = await sb.from('ferias_saldo').upsert({
      tenant_id:                  tenantId,
      colaborador_id:             colabId,
      inicio_periodo_aquisitivo:  r.INICIO_PERIODO_AQUISITIVO || null,
      fim_periodo_aquisitivo:     r.FIM_PERIODO_AQUISITIVO || null,
      fim_periodo_concessivo:     r.FIM_PERIODO_CONCESSIVO || null,
      ferias_programadas_inicio:  r.FERIAS_PROGRAMADAS_INICIO || null,
      ferias_programadas_fim:     r.FERIAS_PROGRAMADAS_FIM || null,
      ferias_gozadas_inicio:      r.FERIAS_GOZADAS_INICIO || null,
      ferias_gozadas_fim:         r.FERIAS_GOZADAS_FIM || null,
      status_ferias:              r.STATUS_FERIAS || 'NAO_PROGRAMADA'
    }, { onConflict: 'tenant_id,colaborador_id' })
    if (error) ferErr++; else ferOk++
  }
  log(`Migrados: ${ferOk} · Erros: ${ferErr}`, ferErr > 0 ? 'warn' : 'ok')

  // ─────────────────────────────────────────────
  // 5. MIGRAR EXAMES
  // ─────────────────────────────────────────────
  console.log('\n🩺  5. Migrando exames ocupacionais...')
  let examOk = 0
  for (const r of exames) {
    const colabId = colabMap[r.ID_COLABORADOR]
    if (!colabId) continue
    await sb.from('exames_ocupacionais').upsert({
      tenant_id: tenantId, colaborador_id: colabId,
      tipo_exame: r.TIPO_EXAME || null,
      ultimo_exame: r.ULTIMO_EXAME || null,
      proximo_exame: r.PROXIMO_EXAME || null,
      status_exame: r.STATUS_EXAME || null,
      observacao: r.OBSERVACAO || null
    }, { onConflict: 'colaborador_id' })
    examOk++
  }
  log(`Migrados: ${examOk}`, 'ok')

  // ─────────────────────────────────────────────
  // 6. MIGRAR AUSÊNCIAS
  // ─────────────────────────────────────────────
  console.log('\n📅  6. Migrando ausências...')
  let ausOk = 0
  for (const r of ausencias) {
    const colabId = colabMap[r.ID_COLABORADOR]
    if (!colabId || !r.DATA) continue
    await sb.from('ausencias_ocorrencias').insert({
      tenant_id: tenantId, colaborador_id: colabId,
      tipo: r.TIPO || null, data: r.DATA, detalhe: r.DETALHE || null
    }).then(() => ausOk++).catch(() => {})
  }
  log(`Migrados: ${ausOk}`, 'ok')

  // ─────────────────────────────────────────────
  // 7. CRIAR USUÁRIO MASTER INICIAL
  // ─────────────────────────────────────────────
  console.log('\n🔑  7. Criando usuário master inicial...')
  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email: TENANT_EMAIL_ADMIN,
    password: 'LumaRH@2025!',   // ← usuário deve alterar no primeiro acesso
    user_metadata: { nome: 'Anderson Assis', tenant_id: tenantId, role: 'master' },
    email_confirm: true
  })
  if (authErr && !authErr.message.includes('already registered')) {
    log('Erro ao criar usuário: ' + authErr.message, 'error')
  } else {
    log(`Usuário master criado: ${TENANT_EMAIL_ADMIN}`, 'ok')
    log('Senha inicial: LumaRH@2025! — ALTERAR NO PRIMEIRO ACESSO!', 'warn')
  }

  // ─────────────────────────────────────────────
  // RESUMO
  // ─────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════')
  console.log('  ✅ Migração concluída!')
  console.log(`  Tenant ID: ${tenantId}`)
  console.log(`  Colaboradores: ${colabOk}`)
  console.log(`  Próximo passo: acesse ${SUPABASE_URL.replace('https://','https://app.supabase.com/project/')} e verifique os dados`)
  console.log('══════════════════════════════════════════════\n')
}

migrate().catch(e => {
  console.error('\n✗ Migração falhou:', e.message)
  process.exit(1)
})
