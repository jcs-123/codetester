import { Resend } from "resend";

import { emailEnabled, env } from "@/lib/env";

type Mail = { to: string; subject: string; html: string; text: string };

export async function sendEmail(mail: Mail): Promise<{ sent: boolean }> {
  if (!emailEnabled) {
    // Development without Resend: print the message so the link can be used.
    console.warn(`[email disabled] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}`);
    return { sent: false };
  }
  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  return { sent: true };
}

export function passwordResetMail(to: string, name: string, link: string): Mail {
  const subject = `${env.APP_NAME}: reset your password`;
  const text = `Hello ${name},

A password reset was requested for your ${env.APP_NAME} account.
Open this link within 30 minutes to choose a new password:

${link}

If you did not request this, you can ignore this email.`;
  const html = `<p>Hello ${escapeHtml(name)},</p>
<p>A password reset was requested for your ${escapeHtml(env.APP_NAME)} account.
Open this link within <strong>30 minutes</strong> to choose a new password:</p>
<p><a href="${link}">${link}</a></p>
<p>If you did not request this, you can ignore this email.</p>`;
  return { to, subject, html, text };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
