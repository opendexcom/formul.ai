import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export function parseEnvBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }
  return defaultValue;
}

export function createSmtpTransportOptions(): SMTPTransport.Options {
  const port = Number(process.env.SMTP_PORT) || 1025;
  const secure = parseEnvBoolean(process.env.SMTP_SECURE, port === 465);
  const user = process.env.SMTP_USER?.trim();

  const options: SMTPTransport.Options = {
    host: process.env.SMTP_HOST || 'localhost',
    port,
    secure,
  };

  if (user) {
    options.auth = {
      user,
      pass: process.env.SMTP_PASS ?? '',
    };
  }

  const rejectUnauthorized = parseEnvBoolean(
    process.env.SMTP_TLS_REJECT_UNAUTHORIZED,
    true,
  );
  if (!rejectUnauthorized) {
    options.tls = { rejectUnauthorized: false };
  }

  return options;
}

export function createSmtpTransport() {
  return nodemailer.createTransport(createSmtpTransportOptions());
}
