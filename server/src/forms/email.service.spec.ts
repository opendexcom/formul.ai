import { EmailService } from './email.service';

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' });

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailService();
  });

  describe('sendFormInvitation', () => {
    it('replaces {formUrl} in message and sends to each email', async () => {
      const result = await service.sendFormInvitation({
        formId: 'f1',
        formTitle: 'Survey',
        emails: ['a@test.com', 'b@test.com'],
        subject: 'Invitation',
        message: 'Fill form: {formUrl}',
        formUrl: 'https://app.com/form/1',
      });

      expect(mockSendMail).toHaveBeenCalledTimes(2);
      expect(mockSendMail).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          to: 'a@test.com',
          subject: 'Invitation',
          text: 'Fill form: https://app.com/form/1',
        }),
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ email: 'a@test.com', success: true });
      expect(result[1]).toMatchObject({ email: 'b@test.com', success: true });
    });

    it('does not log recipient email addresses', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      try {
        await service.sendFormInvitation({
          formId: 'f1',
          formTitle: 'Survey',
          emails: ['secret.invitee@example.com'],
          subject: 'Invitation',
          message: 'Hi',
          formUrl: 'https://app.com/form/1',
        });

        const logs = [...logSpy.mock.calls, ...errorSpy.mock.calls]
          .map((args) => args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '))
          .join('\n');
        expect(logs).not.toContain('secret.invitee@example.com');
        expect(logs).toContain('f1');
      } finally {
        logSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });

    it('pushes failure result when sendMail throws', async () => {
      mockSendMail
        .mockResolvedValueOnce({ messageId: 'ok' })
        .mockRejectedValueOnce(new Error('SMTP error'));

      const result = await service.sendFormInvitation({
        formId: 'f1',
        formTitle: 'Survey',
        emails: ['ok@test.com', 'fail@test.com'],
        subject: 'Invitation',
        message: 'Hi',
        formUrl: 'https://app.com/form/1',
      });

      expect(result[0]).toMatchObject({ email: 'ok@test.com', success: true });
      expect(result[1]).toMatchObject({ email: 'fail@test.com', success: false, error: 'SMTP error' });
    });

    it('logs invitation failures by SMTP code/type only, not error.message', async () => {
      const smtpError = new Error(
        'Message failed: 550 5.1.1 <secret.invitee@example.com> User unknown',
      ) as Error & { code: string; responseCode: number };
      smtpError.name = 'Error';
      smtpError.code = 'EENVELOPE';
      smtpError.responseCode = 550;
      mockSendMail.mockRejectedValueOnce(smtpError);

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      try {
        await service.sendFormInvitation({
          formId: 'form-42',
          formTitle: 'Survey',
          emails: ['secret.invitee@example.com'],
          subject: 'Invitation',
          message: 'Hi',
          formUrl: 'https://app.com/form/1',
        });

        const logs = errorSpy.mock.calls
          .map((args) => args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '))
          .join('\n');

        expect(logs).toContain('form-42');
        expect(logs).toContain('EENVELOPE');
        expect(logs).toContain('550');
        expect(logs).not.toContain('secret.invitee@example.com');
        expect(logs).not.toContain('User unknown');
        expect(logs).not.toContain('error.message');
        expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('"error":');
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  describe('sendConfirmationEmail', () => {
    it('builds confirmation URL and sends mail', async () => {
      await service.sendConfirmationEmail('user@test.com', 'token-123');

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.to).toBe('user@test.com');
      expect(call.subject).toBe('Confirm your email address');
      expect(call.text).toContain('confirm-email?token=token-123');
      expect(call.html).toContain('token=token-123');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('builds reset URL and sends mail', async () => {
      await service.sendPasswordResetEmail('user@test.com', 'reset-token');

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.to).toBe('user@test.com');
      expect(call.subject).toBe('Reset your password');
      expect(call.text).toContain('reset-password?token=reset-token');
      expect(call.html).toContain('reset-token');
    });
  });

  describe('testConnection', () => {
    it('returns true', async () => {
      const result = await service.testConnection();
      expect(result).toBe(true);
    });
  });
});
