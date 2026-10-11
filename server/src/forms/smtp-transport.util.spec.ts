import {
  createSmtpTransportOptions,
  parseEnvBoolean,
} from './smtp-transport.util';

describe('smtp-transport.util', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_TLS_REJECT_UNAUTHORIZED;
  });

  afterAll(() => {
    process.env = env;
  });

  describe('parseEnvBoolean', () => {
    it('returns default for empty values', () => {
      expect(parseEnvBoolean(undefined, true)).toBe(true);
      expect(parseEnvBoolean('', false)).toBe(false);
    });

    it('parses true/false strings', () => {
      expect(parseEnvBoolean('true', false)).toBe(true);
      expect(parseEnvBoolean('false', true)).toBe(false);
      expect(parseEnvBoolean('1', false)).toBe(true);
      expect(parseEnvBoolean('0', true)).toBe(false);
    });
  });

  describe('createSmtpTransportOptions', () => {
    it('omits auth when SMTP_USER is not set', () => {
      process.env.SMTP_HOST = 'mail.example.com';
      process.env.SMTP_PORT = '587';

      const options = createSmtpTransportOptions();

      expect(options.auth).toBeUndefined();
      expect(options.secure).toBe(false);
    });

    it('includes auth when SMTP_USER is set', () => {
      process.env.SMTP_USER = 'smtp-user';
      process.env.SMTP_PASS = 'smtp-pass';

      const options = createSmtpTransportOptions();

      expect(options.auth).toEqual({ user: 'smtp-user', pass: 'smtp-pass' });
    });

    it('respects SMTP_SECURE and SMTP_TLS_REJECT_UNAUTHORIZED', () => {
      process.env.SMTP_SECURE = 'false';
      process.env.SMTP_TLS_REJECT_UNAUTHORIZED = 'false';

      const options = createSmtpTransportOptions();

      expect(options.secure).toBe(false);
      expect(options.tls).toEqual({ rejectUnauthorized: false });
    });

    it('defaults secure to true on port 465', () => {
      process.env.SMTP_PORT = '465';

      const options = createSmtpTransportOptions();

      expect(options.secure).toBe(true);
    });
  });
});
