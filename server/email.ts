import { ENV } from "./_core/env";

type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

async function sendTransactionalEmail(message: TransactionalEmail) {
  if (!ENV.sendGridApiKey || !ENV.sendGridFromEmail) {
    throw new Error("O serviço de e-mail transacional não está configurado.");
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.sendGridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: message.to }] }],
      from: {
        email: ENV.sendGridFromEmail,
        name: ENV.sendGridFromName || "NOTIFICADORA SPC BRASIL",
      },
      subject: message.subject,
      content: [
        { type: "text/plain", value: message.text },
        { type: "text/html", value: message.html },
      ],
      mail_settings: { sandbox_mode: { enable: false } },
      tracking_settings: {
        click_tracking: { enable: false, enable_text: false },
        open_tracking: { enable: false },
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const requestId = response.headers.get("x-message-id") || "indisponível";
    throw new Error(
      `Falha no provedor de e-mail (${response.status}; referência ${requestId}).`,
    );
  }
}

function brandedHtml(title: string, body: string, code?: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F5F7FA;font-family:Arial,sans-serif;color:#17324D"><div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #DCE6F0"><div style="height:8px;background:linear-gradient(90deg,#0066CC,#00B67A,#FFD54A)"></div><div style="padding:32px"><p style="margin:0 0 8px;color:#0066CC;font-size:13px;font-weight:700;letter-spacing:.08em">NOTIFICADORA SPC BRASIL</p><h1 style="margin:0 0 18px;font-size:24px">${title}</h1><p style="font-size:16px;line-height:1.6">${body}</p>${code ? `<div style="margin:24px 0;padding:18px;text-align:center;background:#F5F7FA;border-radius:12px;font-size:32px;font-weight:800;letter-spacing:.2em;color:#004A99">${code}</div>` : ""}<p style="font-size:13px;line-height:1.5;color:#60758A">Se você não reconhece esta solicitação, ignore esta mensagem e informe o administrador da sua organização. Nunca compartilhe códigos de acesso.</p></div></div></body></html>`;
}

export async function sendLoginCode(to: string, code: string) {
  await sendTransactionalEmail({
    to,
    subject: "Seu código de acesso — Notificadora SPC Brasil",
    text: `Seu código de acesso é ${code}. Ele expira em 10 minutos. Não compartilhe este código.`,
    html: brandedHtml(
      "Confirme seu acesso",
      "Use o código abaixo para concluir o login. Ele expira em 10 minutos e só pode ser utilizado uma vez.",
      code,
    ),
  });
}

export async function sendPasswordResetCode(to: string, code: string) {
  await sendTransactionalEmail({
    to,
    subject: "Recuperação de senha — Notificadora SPC Brasil",
    text: `Seu código de recuperação é ${code}. Ele expira em 15 minutos. Não compartilhe este código.`,
    html: brandedHtml(
      "Recupere sua senha",
      "Recebemos uma solicitação para redefinir sua senha. Use o código abaixo em até 15 minutos.",
      code,
    ),
  });
}

