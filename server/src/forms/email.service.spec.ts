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
