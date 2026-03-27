// update_email_template.cjs
// Atualiza o template de email de recuperação de senha no Supabase
// Uso: SUPABASE_PAT=seu_token node scripts/update_email_template.cjs
// PAT: Supabase Dashboard → Account → Access Tokens

const https = require('https');

const PROJECT_REF = 'ttclcdppifmmdjztfunl';
const PAT = process.env.SUPABASE_PAT || '';

const RECOVERY_SUBJECT = '[LUMA RH] Redefinição de senha';

const RECOVERY_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f3ff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">

<!-- HEADER -->
<tr><td style="background:#7c3aed;padding:28px 32px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="width:48px;vertical-align:middle;">
      <div style="width:44px;height:44px;background:rgba(255,255,255,0.15);border-radius:10px;text-align:center;line-height:44px;font-size:24px;font-weight:900;color:#ffd000;font-family:monospace;">L</div>
    </td>
    <td style="padding-left:14px;vertical-align:middle;">
      <div style="color:#ffffff;font-size:20px;font-weight:700;font-family:Arial,sans-serif;">LUMA RH</div>
      <div style="color:rgba(255,255,255,0.75);font-size:12px;margin-top:2px;font-family:Arial,sans-serif;letter-spacing:0.05em;text-transform:uppercase;">Gestão de Pessoas</div>
    </td>
  </tr></table>
</td></tr>

<!-- BANNER -->
<tr><td style="background:#f5f3ff;padding:18px 32px;border-bottom:3px solid #7c3aed;">
  <span style="font-size:14px;color:#4c1d95;font-family:Arial,sans-serif;">🔐 &nbsp;Você solicitou a redefinição da sua senha.</span>
</td></tr>

<!-- BODY -->
<tr><td style="padding:32px;">
  <p style="font-size:15px;color:#374151;font-family:Arial,sans-serif;margin:0 0 20px;">Olá,</p>
  <p style="font-size:14px;color:#6b7280;font-family:Arial,sans-serif;margin:0 0 28px;line-height:1.6;">
    Recebemos uma solicitação para redefinir a senha da sua conta no <strong style="color:#374151;">LUMA RH</strong>.
    Clique no botão abaixo para criar uma nova senha segura.
  </p>

  <!-- CTA BUTTON -->
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:0 0 28px;">
    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;background:#7c3aed;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;">
      Criar nova senha
    </a>
  </td></tr></table>

  <!-- INFO TABLE -->
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
    <tr style="background:#f8fafc;">
      <td style="padding:10px 16px;color:#6b7280;font-weight:600;text-transform:uppercase;font-size:11px;width:40%;border-bottom:1px solid #e5e7eb;">Validade do link</td>
      <td style="padding:10px 16px;color:#374151;border-bottom:1px solid #e5e7eb;">1 hora</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;color:#6b7280;font-weight:600;text-transform:uppercase;font-size:11px;">Conta</td>
      <td style="padding:10px 16px;color:#7c3aed;font-family:monospace;">{{ .Email }}</td>
    </tr>
  </table>

  <p style="font-size:12px;color:#9ca3af;font-family:Arial,sans-serif;margin:24px 0 0;line-height:1.6;">
    Se você não solicitou a redefinição de senha, pode ignorar este e-mail com segurança.
    Sua senha permanecerá a mesma.<br><br>
    Caso o botão não funcione, copie e cole o link abaixo no navegador:<br>
    <span style="color:#7c3aed;font-size:11px;word-break:break-all;">{{ .ConfirmationURL }}</span>
  </p>
</td></tr>

<!-- FOOTER -->
<tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
  <span style="font-size:11px;color:#9ca3af;font-family:Arial,sans-serif;">
    Este e-mail foi gerado automaticamente pelo sistema LUMA RH · Não responda a esta mensagem
  </span>
</td></tr>

</table>
</td></tr></table>
</body></html>`;

if (!PAT) {
  console.log('\n=== SUPABASE_PAT não definido ===');
  console.log('Opção 1 — Rodar com PAT:');
  console.log('  SUPABASE_PAT=seu_token node scripts/update_email_template.cjs\n');
  console.log('Opção 2 — Atualizar manualmente no Dashboard:');
  console.log('  https://supabase.com/dashboard/project/' + PROJECT_REF + '/auth/templates');
  console.log('\nAssunto do email:');
  console.log(RECOVERY_SUBJECT);
  console.log('\nHTML do template (copie tudo entre os traços):');
  console.log('---');
  console.log(RECOVERY_HTML);
  console.log('---');
  process.exit(0);
}

const body = JSON.stringify({
  mailer_templates: {
    recovery: {
      subject: RECOVERY_SUBJECT,
      content: RECOVERY_HTML
    }
  }
});

const req = https.request({
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/config/auth`,
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${PAT}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✓ Template de email atualizado com sucesso!');
    } else {
      console.error('Erro HTTP', res.statusCode, data);
    }
  });
});
req.on('error', e => console.error('Erro:', e.message));
req.write(body);
req.end();
