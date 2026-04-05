// Supabase Edge Function — Envio de e-mail via Resend
// Deploy: supabase functions deploy send-email
// Secret: supabase secrets set RESEND_API_KEY=re_xxxxxxxxx
//
// O domínio lumaplataforma.com.br deve estar verificado no Resend:
// https://resend.com/domains → Add Domain → lumaplataforma.com.br

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM       = 'LUMA RH <lumarh@lumaplataforma.com.br>'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS })
  }

  if (!RESEND_KEY) {
    return new Response(
      JSON.stringify({ error: 'RESEND_API_KEY não configurada. Execute: supabase secrets set RESEND_API_KEY=re_xxx' }),
      { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const { to, cc, subject, html, attachments } = await req.json()

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: to, subject, html' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const payload: Record<string, unknown> = {
      from: FROM,
      to:   Array.isArray(to) ? to : [to],
      subject,
      html,
    }
    if (cc?.length)          payload.cc          = cc
    if (attachments?.length) payload.attachments = attachments

    const res  = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })

    const data = await res.json()

    return new Response(JSON.stringify(data), {
      status:  res.ok ? 200 : res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status:  500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
