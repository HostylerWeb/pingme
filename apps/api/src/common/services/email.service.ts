import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private smtpTransport: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async sendOtp(to: string, code: string) {
    await this.sendEmail({
      to,
      subject: 'Your PingMe verification code',
      text: `Your verification code is ${code}. It expires in 1 hour.`,
    });
  }

  async sendPasswordReset(to: string, token: string) {
    await this.sendEmail({
      to,
      subject: 'Reset your PingMe password',
      text: `Use this token to reset your password: ${token}. It expires in 1 hour.`,
    });
  }

  private getSmtpTransport(): Transporter | null {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      return null;
    }

    if (!this.smtpTransport) {
      const port = Number(this.config.get('SMTP_PORT', 587));
      const secure = this.config.get<string>('SMTP_SECURE', 'false') === 'true';

      this.smtpTransport = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        requireTLS: !secure,
      });
    }

    return this.smtpTransport;
  }

  private getFromAddress() {
    return (
      this.config.get<string>('SMTP_FROM') ??
      this.config.get<string>('RESEND_FROM_EMAIL') ??
      'PingMe <noreply@pingme.test>'
    );
  }

  private async sendEmail({
    to,
    subject,
    text,
  }: {
    to: string;
    subject: string;
    text: string;
  }) {
    const smtp = this.getSmtpTransport();
    const from = this.getFromAddress();

    if (smtp) {
      await smtp.sendMail({ from, to, subject, text });
      this.logger.log(`Email sent via SMTP to ${to}`);
      return;
    }

    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (apiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, text }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`Resend failed: ${response.status} ${body}`);
        throw new Error('Failed to send email');
      }

      this.logger.log(`Email sent via Resend to ${to}`);
      return;
    }

    this.logger.log(`[DEV] Email to ${to} — ${subject}: ${text}`);
  }
}
