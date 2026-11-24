import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * Sends the OTP email. Pick the provider with EMAIL_PROVIDER:
 *  - console : prints the code in the server log (local dev — no email is sent)
 *  - smtp    : any SMTP server. Easiest: Gmail + an App Password (smtp.gmail.com, port 465)
 *  - resend  : Resend HTTP API (resend.com). Without a verified domain it only delivers to your own Resend email.
 * Throws if the provider rejects the message, so the caller can tell the user it failed.
 */
let transporter: nodemailer.Transporter | null = null;

function smtp() {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // 465 = TLS from the start; 587 = STARTTLS
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transporter;
}

const subject = (otp: string) => `${otp} is your RideMate code`;
const text = (otp: string) => `Your RideMate verification code is ${otp}.\nIt expires in 5 minutes. If you didn't ask for it, ignore this email.`;
const html = (otp: string) => `
  <div style="font-family:Inter,Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #E3E5E9;border-radius:16px">
    <p style="font-size:18px;font-weight:700;margin:0 0 8px">RideMate</p>
    <p style="color:#5B6170;margin:0 0 16px">Your verification code:</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 16px">${otp}</p>
    <p style="color:#5B6170;font-size:13px;margin:0">It expires in 5 minutes. If you didn't ask for it, you can ignore this email.</p>
  </div>`;

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  switch (env.EMAIL_PROVIDER) {
    case 'console':
      logger.info(`Email OTP for ${to.replace(/^(.).*(@.*)$/, '$1***$2')}: ${otp}`);
      return;

    case 'smtp':
      await smtp().sendMail({ from: env.MAIL_FROM, to, subject: subject(otp), text: text(otp), html: html(otp) });
      return;

    case 'resend': {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.MAIL_FROM, to, subject: subject(otp), text: text(otp), html: html(otp) }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return;
    }
  }
}
