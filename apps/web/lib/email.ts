interface PartnerInviteEmailOptions {
  to: string
  inviterName: string
  tempPassword: string
  appUrl: string
}

export async function sendPartnerInviteEmail(options: PartnerInviteEmailOptions): Promise<boolean> {
  const apiKey = process.env['RESEND_API_KEY']
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send')
    return false
  }

  const from = process.env['FROM_EMAIL'] ?? 'noreply@couplespend.app'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: options.to,
        subject: `${options.inviterName} te adicionou ao CoupleSpend`,
        html: buildHtml(options),
      }),
    })
    if (!res.ok) {
      console.error('[email] Resend error:', await res.text())
    }
    return res.ok
  } catch (err) {
    console.error('[email] failed to send partner invite:', err)
    return false
  }
}

function buildHtml({ to, inviterName, tempPassword, appUrl }: PartnerInviteEmailOptions): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;background:#fafafa;margin:0;padding:0;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e4e4e7;">
    <h2 style="margin:0 0 16px;font-size:20px;color:#18181b;">Você foi adicionado ao CoupleSpend</h2>
    <p style="color:#52525b;margin:0 0 12px;"><strong>${inviterName}</strong> te adicionou como parceiro(a) no CoupleSpend.</p>
    <p style="color:#52525b;margin:0 0 20px;">Use as credenciais abaixo para o seu primeiro acesso:</p>
    <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin:0 0 20px;">
      <p style="margin:4px 0;font-size:14px;color:#18181b;"><strong>E-mail:</strong> ${to}</p>
      <p style="margin:4px 0;font-size:14px;color:#18181b;"><strong>Senha temporária:</strong> <code style="background:#e4e4e7;padding:2px 6px;border-radius:4px;">${tempPassword}</code></p>
    </div>
    <p style="color:#71717a;font-size:13px;margin:0 0 24px;">Ao fazer login, você será solicitado(a) a criar uma nova senha.</p>
    <a href="${appUrl}/login"
       style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">
      Acessar CoupleSpend
    </a>
  </div>
</body>
</html>`
}
