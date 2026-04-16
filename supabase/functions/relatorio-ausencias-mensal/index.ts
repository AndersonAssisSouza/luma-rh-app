import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_KEY   = Deno.env.get('RESEND_API_KEY') || ''

serve(async (req) => {
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY)

    // Período: dia 20 do mês anterior até dia 19 do mês atual
    const hoje = new Date()
    const anoAtual = hoje.getFullYear()
    const mesAtual = hoje.getMonth() // 0-indexed

    const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1
    const anoAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual

    const dataInicio = `${anoAnterior}-${String(mesAnterior + 1).padStart(2,'0')}-20`
    const dataFim    = `${anoAtual}-${String(mesAtual + 1).padStart(2,'0')}-19`

    const nomeMesAnterior = new Date(anoAnterior, mesAnterior, 1)
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const nomeMesAtual = new Date(anoAtual, mesAtual, 1)
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    // Buscar ausências no período com dados do colaborador e tenant
    const { data: ausencias, error: e1 } = await sb
      .from('ausencias_ocorrencias')
      .select(`
        tipo, data, cid, observacao,
        colaboradores(nome, email_corporativo, cargo, area),
        tenants:colaboradores(tenant:tenants(id, nome, email_financeiro, email_rh))
      `)
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data')

    if (e1) throw e1

    // Buscar tenants com email_financeiro
    const { data: tenants, error: e2 } = await sb
      .from('tenants')
      .select('id, nome, email_financeiro, email_rh')
      .not('email_financeiro', 'is', null)

    if (e2) throw e2

    const resultados: string[] = []

    for (const tenant of tenants || []) {
      if (!tenant.email_financeiro) continue

      // Filtrar ausências deste tenant
      const ausDoTenant = (ausencias || []).filter((a: any) => {
        return a.colaboradores?.tenant?.id === tenant.id
      })

      if (ausDoTenant.length === 0) {
        resultados.push(`${tenant.nome}: nenhuma ausência no período`)
        continue
      }

      // Montar tabela HTML do email
      const linhas = ausDoTenant.map((a: any) => {
        const c = a.colaboradores || {}
        const tipo = a.tipo || '—'
        const data = new Date(a.data + 'T12:00:00').toLocaleDateString('pt-BR')
        const cid  = a.cid ? `CID ${a.cid}` : ''
        return `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${c.nome || '—'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${c.cargo || '—'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${data}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${tipo}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${cid}</td>
          </tr>`
      }).join('')

      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family:system-ui,sans-serif;color:#1f2937;max-width:700px;margin:0 auto;padding:24px;">
  <div style="background:#1e0b3e;padding:20px 32px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:14px;">
    <svg width="36" height="36" viewBox="0 0 100 100"><rect width="100" height="100" rx="12" fill="#9b66f4"/><polygon points="20,15 42,15 50,72 58,15 80,15 60,88 40,88" fill="#ffd000"/></svg>
    <div>
      <div style="color:#fff;font-size:18px;font-weight:700;">LUMA RH</div>
      <div style="color:rgba(255,255,255,.6);font-size:12px;">Relatório Mensal de Ausências</div>
    </div>
  </div>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:28px 32px;">
    <h2 style="font-size:17px;font-weight:700;color:#1e0b3e;margin:0 0 8px;">Relatório de Ausências — ${tenant.nome}</h2>
    <p style="color:#6b7280;font-size:13px;margin:0 0 20px;">
      Período: <strong>20 de ${nomeMesAnterior}</strong> a <strong>19 de ${nomeMesAtual}</strong>
    </p>

    <p style="font-size:13px;margin-bottom:16px;">
      Os colaboradores listados abaixo registraram ausências no período acima. Solicitamos que a contabilidade realize os devidos ajustes de <strong>vale-transporte</strong> e <strong>vale-alimentação</strong> quando aplicável, conforme política da empresa.
    </p>

    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#1e0b3e;color:#fff;">
          <th style="padding:10px 12px;text-align:left;font-weight:600;">Colaborador</th>
          <th style="padding:10px 12px;text-align:left;font-weight:600;">Cargo</th>
          <th style="padding:10px 12px;text-align:left;font-weight:600;">Data</th>
          <th style="padding:10px 12px;text-align:left;font-weight:600;">Tipo</th>
          <th style="padding:10px 12px;text-align:left;font-weight:600;">CID</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>

    <p style="margin-top:24px;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;">
      Este e-mail foi gerado automaticamente pelo LUMA RH em ${new Date().toLocaleDateString('pt-BR')}.<br>
      Para dúvidas, entre em contato com o setor de RH.
    </p>
  </div>
</body>
</html>`

      // Enviar via Resend
      if (RESEND_KEY) {
        const destinatarios = [tenant.email_financeiro]
        if (tenant.email_rh && tenant.email_rh !== tenant.email_financeiro) {
          destinatarios.push(tenant.email_rh)
        }

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'LUMA RH <lumarh@lumaplataforma.com.br>',
            to: destinatarios,
            subject: `Relatório de Ausências ${nomeMesAnterior} — ${tenant.nome}`,
            html
          })
        })

        if (!resendRes.ok) {
          const err = await resendRes.text()
          console.error(`Erro ao enviar para ${tenant.nome}:`, err)
          resultados.push(`${tenant.nome}: ERRO no envio — ${err}`)
        } else {
          resultados.push(`${tenant.nome}: email enviado para ${destinatarios.join(', ')} (${ausDoTenant.length} ausências)`)
        }
      } else {
        resultados.push(`${tenant.nome}: RESEND_KEY não configurada — ${ausDoTenant.length} ausências encontradas`)
        console.log('HTML do email (dry run):', html.slice(0, 500))
      }
    }

    return new Response(JSON.stringify({ ok: true, periodo: `${dataInicio} a ${dataFim}`, resultados }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('Erro no relatório de ausências:', err)
    return new Response(JSON.stringify({ ok: false, erro: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
