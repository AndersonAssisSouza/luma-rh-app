// Edge Function: send-magic-link
// Gera magic link via Supabase Admin e envia com template LUMA RH via Resend
// Registra na tabela email_logs para aparecer na tela "E-mails Enviados"
// Deploy: supabase functions deploy send-magic-link
// Secrets necessários: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_KEY     = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const FROM           = 'LUMA RH <noreply@lumaplataforma.com.br>'
const PROD_URL       = 'https://lumarhapp.vercel.app'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

function buildEmailHtml(magicLink: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);max-width:560px;width:100%;">
      <!-- HEADER -->
      <tr>
        <td style="background:#7c3aed;padding:24px 32px;text-align:center;">
          <table cellpadding="0" cellspacing="0" align="center">
            <tr>
              <td style="background:#9b66f4;border-radius:8px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                <span style="color:#ffd000;font-size:22px;font-weight:900;line-height:40px;display:block;">V</span>
              </td>
              <td style="padding-left:12px;">
                <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.5px;">LUMA RH</span>
              </td>
            </tr>
          </table>
          <p style="color:rgba(255,255,255,.85);font-size:13px;margin:8px 0 0;">Portal de Cadastro de Colaboradores</p>
        </td>
      </tr>
      <!-- BODY -->
      <tr>
        <td style="padding:36px 40px 28px;">
          <h2 style="color:#7c3aed;font-size:20px;margin:0 0 12px;">🔐 Acesse seu cadastro</h2>
          <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Você solicitou um link de acesso para <strong>atualizar seu cadastro</strong> no sistema LUMA RH.<br>
            Clique no botão abaixo para confirmar sua identidade e acessar o formulário:
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td align="center" style="background:#7c3aed;border-radius:8px;">
                <a href="${magicLink}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:.3px;">
                  ✓ Acessar meu cadastro
                </a>
              </td>
            </tr>
          </table>
          <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:24px 0 0;">
            ⏱ Este link é válido por <strong>1 hora</strong> e pode ser usado apenas uma vez.<br>
            Se você não solicitou este acesso, ignore este email — seu cadastro permanece seguro.
          </p>
        </td>
      </tr>
      <!-- DIVIDER -->
      <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #ede9fe;margin:0;"></td></tr>
      <!-- FOOTER -->
      <tr>
        <td style="padding:20px 40px 28px;text-align:center;">
          <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;">
            LUMA RH · Portal de Cadastro Seguro<br>
            Dúvidas? Fale com o RH pelo e-mail do seu escritório.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS })

  try {
    const { email, redirectTo } = await req.json()
    if (!email) {
      return new Response(JSON.stringify({ error: 'email obrigatório' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    const redirect = redirectTo || `${PROD_URL}/onboarding.html?flow=atualizar`

    // Admin client (service role — bypassa RLS)
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 1. Gerar magic link via Admin API
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: redirect }
    })
    if (linkErr) throw new Error('generateLink: ' + linkErr.message)

    const magicLink = linkData?.properties?.action_link
    if (!magicLink) throw new Error('action_link não retornado')

    // 2. Enviar via Resend com template LUMA RH
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    FROM,
        to:      [email],
        subject: 'LUMA RH — Link de acesso ao seu cadastro',
        html:    buildEmailHtml(magicLink),
      })
    })

    const resData = await res.json()
    if (!res.ok) throw new Error('Resend: ' + JSON.stringify(resData))

    // 3. Registrar em email_logs (fire-and-forget — não bloqueia resposta)
    logEmail(admin, email, resData.id ?? null, 'enviado', null).catch(() => {})

    return new Response(JSON.stringify({ ok: true, id: resData.id }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})

/** Busca tenant_id do colaborador e insere em email_logs via service role. */
async function logEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
  resendId: string | null,
  status: string,
  erroMsg: string | null,
): Promise<void> {
  // Busca tenant_id pelo e-mail do colaborador na tabela colaboradores
  const { data: colab } = await admin
    .from('colaboradores')
    .select('tenant_id, nome')
    .ilike('email_corporativo', email)
    .maybeSingle()

  const tenantId = colab?.tenant_id
  if (!tenantId) return   // sem tenant não registra (evita violação NOT NULL)

  await admin.from('email_logs').insert({
    tenant_id:        tenantId,
    para:             email,
    assunto:          'LUMA RH — Link de acesso ao seu cadastro',
    tipo:             'magic_link',
    colaborador_nome: colab?.nome ?? null,
    resend_id:        resendId,
    status,
    erro_msg:         erroMsg,
    enviado_por:      'sistema (onboarding)',
  })
}
