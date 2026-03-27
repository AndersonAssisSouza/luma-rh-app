// update_email_template.cjs
// Atualiza o template de email de recuperação de senha no Supabase
// Uso: SUPABASE_PAT=seu_token node scripts/update_email_template.cjs
// PAT: Supabase Dashboard → Account → Access Tokens

const https = require('https');

const PROJECT_REF = 'ttclcdppifmmdjztfunl';
const PAT = process.env.SUPABASE_PAT || '';

const RECOVERY_SUBJECT = '[LUMA RH] Redefinição de senha';

const RECOVERY_HTML = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f0f0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e0e0e0;">
<!-- HEADER -->
<tr><td style="background:#7c3aed;padding:28px 32px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><span style="font-size:24px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;">🔐 Redefinição de Senha</span><br>
    <span style="font-size:12px;color:#d8b4fe;font-family:Arial,sans-serif;">Portal RH · Luma Plataforma</span></td>
    <td align="right"><span style="font-size:32px;">🔑</span></td>
  </tr></table>
</td></tr>
<!-- BODY -->
<tr><td style="padding:32px;">
  <p style="font-size:15px;color:#374151;font-family:Arial,sans-serif;margin:0 0 24px;line-height:1.6;">Olá,<br>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>LUMA RH</strong>.</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;border:1px solid #e5e7eb;">
    <tr style="background:#ede9fe;"><td style="padding:11px 16px;color:#6b21a8;font-weight:700;border-bottom:1px solid #e5e7eb;width:38%;">Ação</td><td style="padding:11px 16px;font-weight:700;color:#111;border-bottom:1px solid #e5e7eb;">Redefinição de senha</td></tr>
    <tr style="background:#fafafa;"><td style="padding:11px 16px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Conta</td><td style="padding:11px 16px;color:#7c3aed;font-family:monospace;border-bottom:1px solid #e5e7eb;">{{ .Email }}</td></tr>
    <tr><td style="padding:11px 16px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Validade</td><td style="padding:11px 16px;color:#111;font-weight:700;border-bottom:1px solid #e5e7eb;">1 hora</td></tr>
    <tr style="background:#fafafa;"><td style="padding:11px 16px;color:#6b7280;">Sistema</td><td style="padding:11px 16px;color:#111;">LUMA RH · Gestão de Pessoas</td></tr>
  </table>
  <p style="font-size:13px;color:#6b7280;font-family:Arial,sans-serif;margin:28px 0 14px;">Clique no botão abaixo para criar uma nova senha:</p>
  <table cellpadding="0" cellspacing="0"><tr>
    <td><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:14px 32px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;border:2px solid #6d28d9;">🔑 Criar Nova Senha</a></td>
  </tr></table>
  <p style="font-size:12px;color:#9ca3af;font-family:Arial,sans-serif;margin:24px 0 0;line-height:1.6;">
    Se você não solicitou a redefinição de senha, ignore este e-mail — sua senha permanece a mesma.<br>
    Caso o botão não funcione, acesse: <span style="color:#7c3aed;word-break:break-all;">{{ .ConfirmationURL }}</span>
  </p>
</td></tr>
<!-- FOOTER -->
<tr><td style="background:#f3f4f6;padding:14px 32px;border-top:1px solid #e5e7eb;">
  <span style="font-size:11px;color:#9ca3af;font-family:Arial,sans-serif;">Portal RH &middot; Luma Plataforma &middot; Mensagem automática &middot; Não responda este e-mail</span>
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
