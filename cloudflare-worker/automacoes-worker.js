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

async function enviarWebhook(env, webhookUrl, payload) {
  if (!webhookUrl) return null;
  try {
    // Suporta Teams (Adaptive Card) e webhook genérico (JSON simples)
    const isTeams = webhookUrl.includes('office.com') || webhookUrl.includes('webhook.office') || webhookUrl.includes('logic.azure');

    let body;
    if (isTeams) {
      // Microsoft Teams Incoming Webhook — formato Adaptive Card simples
      body = JSON.stringify({
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "7c3aed",
        "summary": payload.titulo || "Alerta LUMA RH",
        "sections": [{
          "activityTitle": `🔔 ${payload.titulo || 'Alerta LUMA RH'}`,
          "activitySubtitle": payload.subtitulo || new Date().toLocaleDateString('pt-BR'),
          "activityImage": "https://app.lumaplataforma.com.br/favicon.ico",
          "facts": (payload.itens || []).map(item => ({ "name": item.label, "value": item.valor })),
          "markdown": true
        }],
        "potentialAction": payload.linkUrl ? [{
          "@type": "OpenUri",
          "name": "Abrir LUMA RH",
          "targets": [{ "os": "default", "uri": payload.linkUrl }]
        }] : []
      });
    } else {
      // Webhook genérico (Z-API WhatsApp, Slack, n8n, etc.)
      body = JSON.stringify({
        titulo: payload.titulo,
        mensagem: payload.mensagem || (payload.itens || []).map(i => `• ${i.label}: ${i.valor}`).join('\n'),
        timestamp: new Date().toISOString(),
        sistema: 'LUMA RH'
      });
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error('enviarWebhook error:', e.message);
    return { ok: false, error: e.message };
  }
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
    sbGet(env, 'colaboradores', `id=in.(${colabIds.join(',')})&status=eq.ATIVO&select=id,nome,cargo,gestor,gestor_email`),
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
// Automação 2 — Exames ocupacionais
// - AGENDADO com data_agendamento vencida → promove para AGUARDANDO_CONFIRMACAO
// - AGUARDANDO_CONFIRMACAO → alerta para confirmar realização
// - Vencidos (proximo_exame < hoje) → alerta urgente
// - Vencendo em ≤30 dias e PENDENTES → alerta preventivo
// - Sem data programada (proximo_exame IS NULL) → alerta "exame em aberto"
// ─────────────────────────────────────────────────────────────
async function checkExames(env, today, alertas) {
  const in30 = addDays(today, 30)

  // 1. Promover AGENDADO → AGUARDANDO_CONFIRMACAO quando data_agendamento passou
  const agendados = await sbGet(
    env,
    'exames_ocupacionais',
    `status_exame=eq.AGENDADO&data_agendamento=lt.${today}&select=id`
  )
  for (const r of agendados) {
    await sbPatch(env, 'exames_ocupacionais', `id=eq.${r.id}`, {
      status_exame: 'AGUARDANDO_CONFIRMACAO'
    })
  }
  if (agendados.length) alertas.push(`Exames promovidos para AGUARDANDO_CONFIRMACAO: ${agendados.length}`)

  // 2a. Exames com status de ação necessária (PENDENTE, VENCIDO, AGUARDANDO_CONFIRMACAO)
  const rowsStatus = await sbGet(
    env,
    'exames_ocupacionais',
    `status_exame=in.(PENDENTE,VENCIDO,AGUARDANDO_CONFIRMACAO)&select=id,colaborador_id,tenant_id,tipo_exame,proximo_exame,data_agendamento,status_exame`
  )

  // 2b. Exames EM_DIA mas vencendo nos próximos 30 dias
  const rowsVenc30 = await sbGet(
    env,
    'exames_ocupacionais',
    `proximo_exame=lte.${in30}&status_exame=in.(EM_DIA)&select=id,colaborador_id,tenant_id,tipo_exame,proximo_exame,data_agendamento,status_exame`
  )

  // 2c. Exames sem data programada (proximo_exame IS NULL) — "exames em aberto"
  const rowsSemData = await sbGet(
    env,
    'exames_ocupacionais',
    `proximo_exame=is.null&status_exame=not.in.(EM_DIA,INATIVO,AGENDADO,AGUARDANDO_CONFIRMACAO)&select=id,colaborador_id,tenant_id,tipo_exame,proximo_exame,data_agendamento,status_exame`
  )

  // Deduplica por id
  const allRows = [...rowsStatus, ...rowsVenc30, ...rowsSemData]
    .filter((r, i, a) => a.findIndex(x => x.id === r.id) === i)

  if (!allRows.length) return

  const colabIds  = [...new Set(allRows.map(r => r.colaborador_id))]
  const tenantIds = [...new Set(allRows.map(r => r.tenant_id))]

  const [colabs, tenants] = await Promise.all([
    sbGet(env, 'colaboradores', `id=in.(${colabIds.join(',')})&status=eq.ATIVO&select=id,nome,gestor_email`),
    sbGet(env, 'tenants',       `id=in.(${tenantIds.join(',')})&select=id,nome,email_admin,email_rh`),
  ])

  const colabMap  = byId(colabs)
  const tenantMap = byId(tenants)

  const grupos = {}
  for (const r of allRows) {
    const c  = colabMap[r.colaborador_id]
    const t  = tenantMap[r.tenant_id]
    if (!c || !t) continue
    const dest = c.gestor_email || t.email_rh || t.email_admin
    if (!dest) continue
    if (!grupos[dest]) grupos[dest] = []
    grupos[dest].push({ ...r, _nome: c.nome, _tenant: t.nome })
  }

  for (const [dest, items] of Object.entries(grupos)) {
    const aguardConf  = items.filter(i => i.status_exame === 'AGUARDANDO_CONFIRMACAO')
    const vencidos    = items.filter(i => i.proximo_exame && i.proximo_exame < today && i.status_exame !== 'AGUARDANDO_CONFIRMACAO')
    const vencendo30  = items.filter(i => i.proximo_exame && i.proximo_exame >= today && i.proximo_exame <= in30)
    const semData     = items.filter(i => !i.proximo_exame && i.status_exame !== 'AGUARDANDO_CONFIRMACAO')

    const lista = items.map(i => {
      if (i.status_exame === 'AGUARDANDO_CONFIRMACAO') {
        return `<li style="margin-bottom:8px"><strong>${i._nome}</strong> — ${i.tipo_exame || 'Exame ocupacional'}<br>
          <span style="color:#b4690e;font-weight:600">⏳ Agendado para ${fmtDate(i.data_agendamento)} — confirme a realização no sistema</span> · ${i._tenant}</li>`
      }
      if (!i.proximo_exame) {
        return `<li style="margin-bottom:8px"><strong>${i._nome}</strong> — ${i.tipo_exame || 'Exame ocupacional'}<br>
          <span style="color:#6b21a8;font-weight:600">⚠ Sem data de exame programada — cadastre no sistema</span> · ${i._tenant}</li>`
      }
      const venc = i.proximo_exame < today
      const diasRestantes = Math.round((new Date(i.proximo_exame) - new Date(today)) / 864e5)
      return `<li style="margin-bottom:8px"><strong>${i._nome}</strong> — ${i.tipo_exame || 'Exame ocupacional'}<br>
        <span style="color:${venc ? '#b4271f' : '#b4690e'};font-weight:600">
          ${venc ? `❌ Vencido em ${fmtDate(i.proximo_exame)}` : `⏰ Vence em ${fmtDate(i.proximo_exame)} (${diasRestantes} dias)`}
        </span> · ${i._tenant}</li>`
    }).join('')

    const partes = []
    if (vencidos.length)   partes.push(`<strong style="color:#b4271f">${vencidos.length} vencido(s)</strong>`)
    if (aguardConf.length) partes.push(`<strong>${aguardConf.length} aguardando confirmação</strong>`)
    if (vencendo30.length) partes.push(`<strong>${vencendo30.length} vencendo em até 30 dias</strong>`)
    if (semData.length)    partes.push(`<strong>${semData.length} sem data programada</strong>`)

    const corpo = `
      <p>${partes.join(' · ')}</p>
      <ul style="padding-left:18px;margin:16px 0">${lista}</ul>
      ${vencidos.length ? `<div style="margin-top:16px;padding:14px 16px;background:#fef2f2;border-radius:8px;border-left:3px solid #b4271f;font-size:13px">
        🚨 Exames vencidos violam a NR-7. Agende imediatamente e notifique o colaborador por escrito.
      </div>` : ''}
      ${semData.length ? `<div style="margin-top:16px;padding:14px 16px;background:#f5f3ff;border-radius:8px;border-left:3px solid #7c3aed;font-size:13px">
        📋 Exames sem data programada: acesse LUMA RH → Exames e cadastre a próxima data prevista.
      </div>` : ''}
      ${aguardConf.length ? `<div style="margin-top:16px;padding:14px 16px;background:#fbf0da;border-radius:8px;border-left:3px solid #b4690e;font-size:13px">
        📌 Acesse LUMA RH → Exames e clique em <strong>Confirmar</strong> nos itens em laranja.
      </div>` : ''}
      <p style="margin-top:12px">Exames em dia garantem conformidade com a NR-7 (PCMSO).</p>`

    await enviarEmail(
      env, dest,
      `🩺 ${items.length} exame(s) a regularizar — LUMA RH`,
      emailBase('Exames Ocupacionais — Ação Necessária', corpo, '#b4690e')
    )

    alertas.push(`Exames: ${vencidos.length} vencidos, ${vencendo30.length} vencendo/30d, ${semData.length} sem data → ${dest}`)
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
    sbGet(env, 'colaboradores', `id=in.(${colabIds.join(',')})&status=eq.ATIVO&select=id,nome,gestor,gestor_email`),
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
// Automação 5 — Relatório Mensal de RH (dia 1 de cada mês)
// ─────────────────────────────────────────────────────────────
async function checkRelatorioMensal(env) {
  // Só executa no dia 1 de cada mês
  if (new Date().getDate() !== 1) return { skipped: true, motivo: 'não é dia 1' }

  // Busca dados do tenant
  const tenants = await sbGet(env, 'tenants', 'select=id,nome,email_admin&status=eq.ATIVO&limit=10')
  if (!tenants?.length) return { skipped: true, motivo: 'sem tenants' }

  let totalEnviados = 0

  for (const tenant of tenants) {
    if (!tenant.email_admin) continue

    // Colaboradores ativos
    const colab = await sbGet(env, 'colaboradores', `tenant_id=eq.${tenant.id}&status=eq.ATIVO&select=id,nome,tipo_vinculo,data_admissao,cargo,area`)
    const total = colab?.length || 0

    // Distribuição por vínculo
    const vinculos = {}
    ;(colab || []).forEach(c => {
      const v = c.tipo_vinculo || 'N/A'
      vinculos[v] = (vinculos[v] || 0) + 1
    })

    // Exames
    const exames = await sbGet(env, 'exames_ocupacionais', `tenant_id=eq.${tenant.id}&select=status_exame,colaboradores(status)`)
    const exAtivos = (exames || []).filter(e => e.colaboradores?.status === 'ATIVO')
    const exVencidos  = exAtivos.filter(e => e.status_exame === 'VENCIDO').length
    const exPendentes = exAtivos.filter(e => e.status_exame === 'PENDENTE').length
    const exAgendados = exAtivos.filter(e => e.status_exame === 'AGENDADO' || e.status_exame === 'AGUARDANDO_CONFIRMACAO').length
    const exOk        = exAtivos.filter(e => e.status_exame === 'EM_DIA').length

    // Férias pendentes
    const hoje = new Date().toISOString().split('T')[0]
    const ferias = await sbGet(env, 'ferias_saldo', `tenant_id=eq.${tenant.id}&select=status_ferias,colaboradores(status)`)
    const ferAtivos  = (ferias || []).filter(f => f.colaboradores?.status === 'ATIVO')
    const ferNaoProg = ferAtivos.filter(f => !f.status_ferias || f.status_ferias === 'NAO_PROGRAMADA').length

    // Solicitações pendentes
    const sols = await sbGet(env, 'solicitacoes_ferias', `tenant_id=eq.${tenant.id}&status=eq.PENDENTE&select=id,colaboradores(nome)`)
    const solsPendentes = sols?.length || 0

    // Desligamentos próximos (30 dias)
    const d30 = new Date(); d30.setDate(d30.getDate() + 30)
    const d30str = d30.toISOString().split('T')[0]
    const desl = await sbGet(env, 'desligamentos_agendados', `tenant_id=eq.${tenant.id}&data_desligamento=gte.${hoje}&data_desligamento=lte.${d30str}&select=data_desligamento,colaboradores(nome,cargo)`)
    const deslProx = desl?.length || 0

    const mes    = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const mesProx = new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString('pt-BR', { month: 'long' })

    const vincHtml = Object.entries(vinculos).map(([v, n]) =>
      `<tr><td style="padding:6px 12px;color:#6b7280;">${v}</td><td style="padding:6px 12px;text-align:right;font-weight:600;">${n}</td></tr>`
    ).join('')

    const solsHtml = solsPendentes > 0
      ? `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px;margin-top:12px;">
           ⚠️ <strong>${solsPendentes} solicitação(ões) de férias</strong> aguardando aprovação
         </div>` : ''

    const deslHtml = deslProx > 0
      ? `<div style="background:#fee2e2;border:1px solid #ef4444;border-radius:8px;padding:12px;margin-top:8px;">
           🚨 <strong>${deslProx} desligamento(s)</strong> agendado(s) nos próximos 30 dias
         </div>` : ''

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

<tr><td style="background:linear-gradient(135deg,#7c3aed,#5b21b6);padding:32px;">
  <table width="100%"><tr>
    <td><div style="font-size:26px;font-weight:700;color:#fff;">📊 Relatório Mensal RH</div>
    <div style="font-size:13px;color:#c4b5fd;margin-top:4px;">${tenant.nome} · ${mes}</div></td>
    <td align="right"><div style="font-size:42px;">📋</div></td>
  </tr></table>
</td></tr>

<tr><td style="padding:28px;">

  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px;margin-bottom:20px;">
  <tr>
    <td style="background:#ede9fe;border-radius:10px;padding:16px;text-align:center;width:25%;">
      <div style="font-size:32px;font-weight:700;color:#7c3aed;">${total}</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Ativos</div>
    </td>
    <td style="background:#dcfce7;border-radius:10px;padding:16px;text-align:center;width:25%;">
      <div style="font-size:32px;font-weight:700;color:#16a34a;">${exOk}</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Exames OK</div>
    </td>
    <td style="background:${exVencidos > 0 ? '#fee2e2' : '#f9fafb'};border-radius:10px;padding:16px;text-align:center;width:25%;">
      <div style="font-size:32px;font-weight:700;color:${exVencidos > 0 ? '#dc2626' : '#9ca3af'};">${exVencidos}</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Ex. Vencidos</div>
    </td>
    <td style="background:${ferNaoProg > 0 ? '#fef3c7' : '#f9fafb'};border-radius:10px;padding:16px;text-align:center;width:25%;">
      <div style="font-size:32px;font-weight:700;color:${ferNaoProg > 0 ? '#d97706' : '#9ca3af'};">${ferNaoProg}</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Férias Pend.</div>
    </td>
  </tr></table>

  <div style="font-size:14px;font-weight:700;color:#111;margin-bottom:8px;">👥 Distribuição por Vínculo</div>
  <table width="100%" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
    ${vincHtml}
  </table>

  <div style="font-size:14px;font-weight:700;color:#111;margin-bottom:8px;">🏥 Exames Ocupacionais</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
    <span style="background:#dcfce7;color:#16a34a;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:600;">✅ Em dia: ${exOk}</span>
    <span style="background:#fef3c7;color:#d97706;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:600;">📅 Agendados: ${exAgendados}</span>
    <span style="background:#fee2e2;color:#dc2626;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:600;">❌ Vencidos: ${exVencidos}</span>
    <span style="background:#f3f4f6;color:#6b7280;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:600;">⏳ Pendentes: ${exPendentes}</span>
  </div>

  ${solsHtml}${deslHtml}

  ${deslProx > 0 ? `<table width="100%" style="border-collapse:collapse;margin-top:8px;font-size:13px;">
    ${(desl || []).map(d => `<tr><td style="padding:6px 0;color:#374151;">• ${d.colaboradores?.nome || '—'}</td><td style="text-align:right;color:#dc2626;font-weight:600;">${d.data_desligamento}</td></tr>`).join('')}
  </table>` : ''}

</td></tr>

<tr><td style="background:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;">
  <span style="font-size:11px;color:#9ca3af;">Relatório automático · LUMA RH · ${new Date().toLocaleDateString('pt-BR')} · Próximo: 1° de ${mesProx}</span>
</td></tr>

</table></td></tr></table>
</body></html>`

    await enviarEmail(env, tenant.email_admin, `📊 Relatório Mensal RH — ${tenant.nome} · ${mes}`, html)
    await logEvento(env, 'RELATORIO_MENSAL', `Relatório de ${mes} enviado para ${tenant.email_admin}`, { tenant_id: tenant.id, total, exVencidos, ferNaoProg, solsPendentes, deslProx })
    totalEnviados++
  }

  return { ok: true, tenants: totalEnviados, mes: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }
}

// ─────────────────────────────────────────────────────────────
// Orquestrador principal
// ─────────────────────────────────────────────────────────────
async function runAutomations(env) {
  const today = new Date().toISOString().slice(0, 10)
  const alertas = []
  const erros   = []

  // Carregar configurações de webhook
  const settingsWebhook = await sbGet(env, 'platform_settings', 'chave=eq.notificacoes&select=valor').catch(() => null)
  const cfgWebhook = settingsWebhook?.[0]?.valor || {}
  const webhookUrl = cfgWebhook.webhookUrl || cfgWebhook.webhook_url || ''

  console.log(`[LUMA Automações] Iniciando — ${today}`)

  // Contadores para o resumo do webhook
  const contadores = { desligamentos: 0, examesUrgentes: 0, feriasUrgentes: 0, faturasVencidas: 0 }

  const checks = [
    ['Desligamentos',     () => checkDesligamentos(env, today, alertas)],
    ['Exames',            () => checkExames(env, today, alertas)],
    ['Férias',            () => checkFerias(env, today, alertas)],
    ['Faturas',           () => checkFaturas(env, today, alertas)],
    ['RelatorioMensal',   () => checkRelatorioMensal(env)],
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

  // Extrair contadores a partir dos alertas registrados
  for (const a of alertas) {
    const mDesl = a.match(/^Desligamentos:.*?(\d+)\s+aviso/)
    if (mDesl) contadores.desligamentos += parseInt(mDesl[1])
    const mExame = a.match(/^Exames:.*?(\d+)\s+pendente/)
    if (mExame) contadores.examesUrgentes += parseInt(mExame[1])
    const mFerias = a.match(/^Férias:.*?(\d+)\s+alerta/)
    if (mFerias) contadores.feriasUrgentes += parseInt(mFerias[1])
    const mFat = a.match(/^Faturas vencidas:\s*(\d+)/)
    if (mFat) contadores.faturasVencidas += parseInt(mFat[1])
  }

  // ── Webhook summary (se configurado) ──
  if (webhookUrl) {
    const alertasCrit = []
    if (contadores.desligamentos > 0)  alertasCrit.push({ label: '🚨 Desligamentos próximos',    valor: `${contadores.desligamentos} nos próximos 7 dias` })
    if (contadores.examesUrgentes > 0) alertasCrit.push({ label: '🏥 Exames vencidos/urgentes',  valor: `${contadores.examesUrgentes} colaboradores` })
    if (contadores.feriasUrgentes > 0) alertasCrit.push({ label: '🌴 Férias no prazo concessivo', valor: `${contadores.feriasUrgentes} colaboradores` })
    if (contadores.faturasVencidas > 0) alertasCrit.push({ label: '💰 Faturas vencidas',          valor: `${contadores.faturasVencidas} pendentes` })

    if (alertasCrit.length > 0) {
      await enviarWebhook(env, webhookUrl, {
        titulo: `⚠️ LUMA RH — ${alertasCrit.length} alerta(s) do dia`,
        subtitulo: new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
        itens: alertasCrit,
        linkUrl: 'https://app.lumaplataforma.com.br/people_analytics_editor.html',
        mensagem: alertasCrit.map(a => `${a.label}: ${a.valor}`).join('\n')
      }).catch(e => console.error('Erro ao enviar webhook:', e.message))
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
