/**
 * LUMA RH — Worker de Automações Diárias
 * Roda via cron trigger (wrangler-automacoes.toml)
 * Cron: 0 11 * * *  →  08h Brasília (UTC-3)
 *
 * Segredos necessários (wrangler secret put):
 *   SUPABASE_SERVICE_KEY   — service_role key do projeto LUMA RH
 *
 * Variável (wrangler.toml vars):
 *   SUPABASE_URL           — https://ttclcdppifmmdjztfunl.supabase.co
 */

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function addDays(date, days) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

async function sbGet(env, table, query = '') {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}${query ? '?' + query : ''}`
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  })
  if (!res.ok) {
    const txt = await res.text()
    console.error(`sbGet ${table} error:`, txt)
    return []
  }
  return res.json()
}

async function sbPatch(env, table, query, body) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}?${query}`
  await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
}

async function sbInsert(env, table, body) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}`
  await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
}

async function enviarEmail(env, to, subject, html) {
  if (!to) return
  const toArr = Array.isArray(to) ? to : [to]
  const url = `${env.SUPABASE_URL}/functions/v1/send-email`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: toArr, subject, html }),
  })
  if (!res.ok) console.error('Erro ao enviar email:', await res.text())
}

function emailBase(titulo, corpo, cor = '#9b66f4') {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f7f7fb;font-family:Inter,system-ui,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
  <tr><td style="background:${cor};padding:24px 32px">
    <div style="font-size:22px;font-weight:700;color:#fff;font-family:'Inter Tight',Inter,sans-serif">${titulo}</div>
    <div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:4px">LUMA RH · Automação Diária</div>
  </td></tr>
  <tr><td style="padding:28px 32px;color:#373a44;font-size:14px;line-height:1.6">${corpo}</td></tr>
  <tr><td style="padding:16px 32px;background:#f7f7fb;font-size:11px;color:#9aa0ad;border-top:1px solid #e6e7ec">
    Este e-mail foi gerado automaticamente pelo sistema LUMA RH. Não responda a esta mensagem.
  </td></tr>
</table></td></tr></table></body></html>`
}

async function logEvento(env, tipo, descricao, dados = {}) {
  await sbInsert(env, 'log_eventos', {
    tipo,
    descricao,
    dados,
  })
}

// ─────────────────────────────────────────────────────────────
// Mapa auxiliar: arrays → objeto por ID
// ─────────────────────────────────────────────────────────────
function byId(arr, key = 'id') {
  return Object.fromEntries((arr || []).map(x => [x[key], x]))
}

// ─────────────────────────────────────────────────────────────
// Automação 1 — Desligamentos agendados (próximos 7 dias)
// ─────────────────────────────────────────────────────────────
async function checkDesligamentos(env, today, alertas) {
  const in7 = addDays(today, 7)

  const rows = await sbGet(
    env,
    'desligamentos_agendados',
    `lembrete_enviado=eq.false&data_desligamento=gte.${today}&data_desligamento=lte.${in7}&select=id,colaborador_id,tenant_id,data_desligamento`
  )
  if (!rows.length) return

  const colabIds  = [...new Set(rows.map(r => r.colaborador_id))]
  const tenantIds = [...new Set(rows.map(r => r.tenant_id))]

  const [colabs, tenants] = await Promise.all([
    sbGet(env, 'colaboradores', `id=in.(${colabIds.join(',')})&select=id,nome,cargo,gestor,gestor_email`),
    sbGet(env, 'tenants',       `id=in.(${tenantIds.join(',')})&select=id,nome,email_admin,email_rh`),
  ])

  const colabMap  = byId(colabs)
  const tenantMap = byId(tenants)

  // Agrupar por destinatário
  const grupos = {}
  for (const r of rows) {
    const c  = colabMap[r.colaborador_id]
    const t  = tenantMap[r.tenant_id]
    if (!c || !t) continue
    const dest = c.gestor_email || t.email_rh || t.email_admin
    if (!dest) continue
    if (!grupos[dest]) grupos[dest] = []
    grupos[dest].push({ ...r, _nome: c.nome, _cargo: c.cargo, _tenant: t.nome })
  }

  for (const [dest, items] of Object.entries(grupos)) {
    const lista = items.map(i =>
      `<li style="margin-bottom:8px"><strong>${i._nome}</strong>${i._cargo ? ` — ${i._cargo}` : ''}<br>
       <span style="color:#b4271f;font-weight:600">Desligamento em ${fmtDate(i.data_desligamento)}</span> · ${i._tenant}</li>`
    ).join('')

    const corpo = `
      <p>Os seguintes colaboradores têm <strong>desligamento agendado nos próximos 7 dias</strong> e ainda não tiveram o lembrete processado:</p>
      <ul style="padding-left:18px;margin:16px 0">${lista}</ul>
      <p>Providencie os trâmites rescisórios, documentação e comunicação interna.</p>
      <div style="margin-top:20px;padding:14px 16px;background:#fbe4e1;border-radius:8px;border-left:3px solid #b4271f;font-size:13px">
        ⚠️ Prazo crítico. Verifique o sistema LUMA RH para detalhes.
      </div>`

    await enviarEmail(
      env, dest,
      `⚠️ ${items.length} desligamento(s) nos próximos 7 dias — LUMA RH`,
      emailBase('Desligamentos Agendados', corpo, '#b4271f')
    )

    // Marcar lembrete enviado
    for (const r of items) {
      await sbPatch(env, 'desligamentos_agendados', `id=eq.${r.id}`, {
        lembrete_enviado: true,
        lembrete_enviado_em: new Date().toISOString(),
      })
    }

    alertas.push(`Desligamentos: ${items.length} aviso(s) → ${dest}`)
  }
}

// ─────────────────────────────────────────────────────────────
// Automação 2 — Exames ocupacionais vencidos ou vencendo em 15 dias
// ─────────────────────────────────────────────────────────────
async function checkExames(env, today, alertas) {
  const in15 = addDays(today, 15)

  const rows = await sbGet(
    env,
    'exames_ocupacionais',
    `proximo_exame=lte.${in15}&select=id,colaborador_id,tenant_id,tipo_exame,proximo_exame,status_exame`
  )
  if (!rows.length) return

  const colabIds  = [...new Set(rows.map(r => r.colaborador_id))]
  const tenantIds = [...new Set(rows.map(r => r.tenant_id))]

  const [colabs, tenants] = await Promise.all([
    sbGet(env, 'colaboradores', `id=in.(${colabIds.join(',')})&select=id,nome,gestor_email`),
    sbGet(env, 'tenants',       `id=in.(${tenantIds.join(',')})&select=id,nome,email_admin,email_rh`),
  ])

  const colabMap  = byId(colabs)
  const tenantMap = byId(tenants)

  const grupos = {}
  for (const r of rows) {
    const c  = colabMap[r.colaborador_id]
    const t  = tenantMap[r.tenant_id]
    if (!c || !t) continue
    const dest = c.gestor_email || t.email_rh || t.email_admin
    if (!dest) continue
    if (!grupos[dest]) grupos[dest] = []
    const vencido = r.proximo_exame < today
    grupos[dest].push({ ...r, _nome: c.nome, _tenant: t.nome, _vencido: vencido })
  }

  for (const [dest, items] of Object.entries(grupos)) {
    const vencidos   = items.filter(i => i._vencido)
    const vencendo   = items.filter(i => !i._vencido)

    const lista = items.map(i =>
      `<li style="margin-bottom:8px"><strong>${i._nome}</strong> — ${i.tipo_exame || 'Exame ocupacional'}<br>
       <span style="color:${i._vencido ? '#b4271f' : '#b4690e'};font-weight:600">
         ${i._vencido ? '❌ Vencido em' : '⏰ Vence em'} ${fmtDate(i.proximo_exame)}
       </span> · ${i._tenant}</li>`
    ).join('')

    const corpo = `
      <p>${vencidos.length > 0 ? `<strong>${vencidos.length} exame(s) já vencido(s)</strong> e ` : ''}${vencendo.length > 0 ? `${vencendo.length} vencendo em até 15 dias.` : ''}</p>
      <ul style="padding-left:18px;margin:16px 0">${lista}</ul>
      <p>Agende os exames para manter a conformidade com a NR-7 e evitar autuações.</p>`

    await enviarEmail(
      env, dest,
      `🩺 ${items.length} exame(s) pendente(s) — LUMA RH`,
      emailBase('Exames Ocupacionais Pendentes', corpo, '#b4690e')
    )

    alertas.push(`Exames: ${items.length} pendente(s) → ${dest}`)
  }
}

// ─────────────────────────────────────────────────────────────
// Automação 3 — Férias período concessivo vencendo em 30 dias
// ─────────────────────────────────────────────────────────────
async function checkFerias(env, today, alertas) {
  const in30 = addDays(today, 30)

  const rows = await sbGet(
    env,
    'ferias_saldo',
    `fim_periodo_concessivo=gte.${today}&fim_periodo_concessivo=lte.${in30}&status_ferias=in.(NAO_PROGRAMADA,PROGRAMADA)&select=id,colaborador_id,tenant_id,fim_periodo_concessivo,status_ferias`
  )
  if (!rows.length) return

  const colabIds  = [...new Set(rows.map(r => r.colaborador_id))]
  const tenantIds = [...new Set(rows.map(r => r.tenant_id))]

  const [colabs, tenants] = await Promise.all([
    sbGet(env, 'colaboradores', `id=in.(${colabIds.join(',')})&select=id,nome,gestor,gestor_email`),
    sbGet(env, 'tenants',       `id=in.(${tenantIds.join(',')})&select=id,nome,email_admin,email_rh`),
  ])

  const colabMap  = byId(colabs)
  const tenantMap = byId(tenants)

  const grupos = {}
  for (const r of rows) {
    const c  = colabMap[r.colaborador_id]
    const t  = tenantMap[r.tenant_id]
    if (!c || !t) continue
    const dest = c.gestor_email || t.email_rh || t.email_admin
    if (!dest) continue
    if (!grupos[dest]) grupos[dest] = []
    grupos[dest].push({ ...r, _nome: c.nome, _tenant: t.nome })
  }

  for (const [dest, items] of Object.entries(grupos)) {
    const lista = items.map(i =>
      `<li style="margin-bottom:8px"><strong>${i._nome}</strong><br>
       <span style="color:#b4690e;font-weight:600">Período concessivo até ${fmtDate(i.fim_periodo_concessivo)}</span>
       ${i.status_ferias === 'PROGRAMADA' ? ' · ⚠️ Programada mas não gozada' : ' · Não programada'}
       · ${i._tenant}</li>`
    ).join('')

    const corpo = `
      <p><strong>${items.length} colaborador(es)</strong> com período concessivo de férias vencendo em até <strong>30 dias</strong>:</p>
      <ul style="padding-left:18px;margin:16px 0">${lista}</ul>
      <p>Férias não gozadas dentro do período concessivo devem ser pagas em dobro (art. 137 da CLT).</p>
      <div style="margin-top:20px;padding:14px 16px;background:#fbf0da;border-radius:8px;border-left:3px solid #b4690e;font-size:13px">
        📌 Programe as férias com antecedência mínima de 30 dias e comunique o colaborador por escrito.
      </div>`

    await enviarEmail(
      env, dest,
      `🏖️ ${items.length} férias vencendo em 30 dias — LUMA RH`,
      emailBase('Férias no Período Concessivo', corpo, '#b4690e')
    )

    alertas.push(`Férias: ${items.length} alerta(s) → ${dest}`)
  }
}

// ─────────────────────────────────────────────────────────────
// Automação 4 — Faturas vencidas (admin LUMA)
// ─────────────────────────────────────────────────────────────
async function checkFaturas(env, today, alertas) {
  // Ler preferências de notificação
  const settings = await sbGet(env, 'platform_settings', `chave=eq.notificacoes&select=valor`)
  const notif = settings?.[0]?.valor || {}
  if (!notif.fatura_vencida || !notif.email_alerta) return

  const faturas = await sbGet(
    env,
    'invoices',
    `status=eq.PENDENTE&vencimento=lt.${today}&select=id,tenant_id,descricao,valor,vencimento`
  )
  if (!faturas.length) return

  const tenantIds = [...new Set(faturas.map(f => f.tenant_id))]
  const tenants = await sbGet(env, 'tenants', `id=in.(${tenantIds.join(',')})&select=id,nome`)
  const tenantMap = byId(tenants)

  const total = faturas.reduce((s, f) => s + parseFloat(f.valor || 0), 0)
  const lista = faturas.map(f =>
    `<li style="margin-bottom:8px"><strong>${tenantMap[f.tenant_id]?.nome || '—'}</strong> — ${f.descricao || 'Fatura'}<br>
     <span style="color:#b4271f;font-weight:600">R$ ${parseFloat(f.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · Venceu em ${fmtDate(f.vencimento)}</span></li>`
  ).join('')

  const corpo = `
    <p><strong>${faturas.length} fatura(s)</strong> com pagamento em atraso:</p>
    <ul style="padding-left:18px;margin:16px 0">${lista}</ul>
    <div style="margin-top:16px;padding:14px 16px;background:#f7f7fb;border-radius:8px;font-size:14px">
      Total em aberto: <strong>R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
    </div>
    <p style="margin-top:16px">Acesse o <a href="https://app.lumaplataforma.com.br/admin.html" style="color:#9b66f4">Admin Console</a> → Faturamento para atualizar os status.</p>`

  await enviarEmail(
    env, notif.email_alerta,
    `💰 ${faturas.length} fatura(s) vencida(s) — LUMA Admin`,
    emailBase('Faturas em Atraso', corpo, '#9b66f4')
  )

  // Marcar como VENCIDO automaticamente
  await sbPatch(
    env,
    'invoices',
    `status=eq.PENDENTE&vencimento=lt.${today}`,
    { status: 'VENCIDO' }
  )

  alertas.push(`Faturas vencidas: ${faturas.length} (R$ ${total.toFixed(2)}) → ${notif.email_alerta}`)
}

// ─────────────────────────────────────────────────────────────
// Orquestrador principal
// ─────────────────────────────────────────────────────────────
async function runAutomations(env) {
  const today = new Date().toISOString().slice(0, 10)
  const alertas = []
  const erros   = []

  console.log(`[LUMA Automações] Iniciando — ${today}`)

  const checks = [
    ['Desligamentos', () => checkDesligamentos(env, today, alertas)],
    ['Exames',        () => checkExames(env, today, alertas)],
    ['Férias',        () => checkFerias(env, today, alertas)],
    ['Faturas',       () => checkFaturas(env, today, alertas)],
  ]

  for (const [nome, fn] of checks) {
    try {
      await fn()
      console.log(`  ✓ ${nome}`)
    } catch (e) {
      console.error(`  ✗ ${nome}:`, e.message)
      erros.push(`${nome}: ${e.message}`)
    }
  }

  // Log no Supabase
  await logEvento(env, 'AUTOMACAO_DIARIA',
    `Automação concluída: ${alertas.length} alerta(s) enviado(s)${erros.length ? `, ${erros.length} erro(s)` : ''}`,
    { data: today, alertas, erros }
  ).catch(e => console.error('Erro ao gravar log:', e))

  console.log(`[LUMA Automações] Concluído — ${alertas.length} alertas, ${erros.length} erros`)
  return { alertas, erros }
}

// ─────────────────────────────────────────────────────────────
// Exports do Worker
// ─────────────────────────────────────────────────────────────
export default {
  // Cron diário (wrangler-automacoes.toml: crons = ["0 11 * * *"])
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAutomations(env))
  },

  // Trigger manual via GET /run?secret=... (para testar sem aguardar cron)
  async fetch(request, env, ctx) {
    const url    = new URL(request.url)
    const secret = url.searchParams.get('secret')

    if (url.pathname === '/run') {
      if (!env.RUN_SECRET || secret !== env.RUN_SECRET) {
        return new Response('Unauthorized', { status: 401 })
      }
      ctx.waitUntil(runAutomations(env))
      return new Response(JSON.stringify({ ok: true, iniciado: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ service: 'LUMA Automações Worker', status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' }
    })
  },
}
