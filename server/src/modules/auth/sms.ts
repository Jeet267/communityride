import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * Sends the OTP text. Pick the provider with SMS_PROVIDER:
 *  - console  : prints the code in the server log (local dev only — nobody receives an SMS)
 *  - fast2sms : Fast2SMS Quick SMS route (any Indian number, no DLT; needs a one-time ₹100 recharge)
 *  - twilio  : Twilio Programmable SMS (trial accounts can only text numbers you verified in Twilio)
 *  - msg91   : MSG91 OTP API (India; needs a DLT-approved OTP template)
 * Throws if the provider rejects the message, so the caller can tell the user it failed.
 */
export async function sendOtpSms(phone: string, otp: string): Promise<void> {
  switch (env.SMS_PROVIDER) {
    case 'console':
      logger.info(`OTP for ****${phone.slice(-4)}: ${otp}`);
      return;

    case 'fast2sms': {
      // Quick SMS route ("q"): plain text, Indian 10-digit number without +91.
      const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: { authorization: env.FAST2SMS_API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: 'q', numbers: phone.replace(/^\+91/, ''), flash: 0,
          message: `${otp} is your RideMate verification code. It expires in 5 minutes. Do not share it with anyone.` }),
        signal: AbortSignal.timeout(8000),
      });
      const body = await res.json().catch(() => ({})) as { return?: boolean; message?: string | string[] };
      if (!res.ok || body.return !== true) throw new Error(`Fast2SMS: ${[body.message].flat().join(' ') || res.status}`);
      return;
    }

    case 'twilio': {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phone, From: env.TWILIO_FROM!, Body: `${otp} is your RideMate code. It expires in 5 minutes.` }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return;
    }

    case 'msg91': {
      const url = new URL('https://control.msg91.com/api/v5/otp');
      url.search = new URLSearchParams({ template_id: env.MSG91_TEMPLATE_ID!, mobile: phone.replace('+', ''), otp }).toString();
      const res = await fetch(url, { method: 'POST', headers: { authkey: env.MSG91_AUTH_KEY! }, signal: AbortSignal.timeout(8000) });
      const body = await res.json().catch(() => ({})) as { type?: string; message?: string };
      if (!res.ok || body.type === 'error') throw new Error(`MSG91: ${body.message ?? res.status}`);
      return;
    }
  }
}
