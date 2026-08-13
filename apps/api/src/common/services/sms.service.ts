import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  async sendOtp(to: string, code: string) {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.config.get<string>('TWILIO_PHONE_NUMBER');
    const verifyServiceSid = this.config.get<string>('TWILIO_VERIFY_SERVICE_SID');

    if (!accountSid || !authToken) {
      this.logger.log(`[DEV] SMS OTP to ${to}: ${code}`);
      return;
    }

    if (verifyServiceSid) {
      const response = await fetch(
        `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: to, Channel: 'sms' }),
        },
      );
      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`Twilio Verify failed: ${response.status} ${text}`);
      }
      return;
    }

    if (!from) {
      this.logger.log(`[DEV] SMS OTP to ${to}: ${code}`);
      return;
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: from,
          Body: `Your PingMe code is ${code}`,
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Twilio SMS failed: ${response.status} ${text}`);
      throw new Error('Failed to send SMS');
    }
  }
}
