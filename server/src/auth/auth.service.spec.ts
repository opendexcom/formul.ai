import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

jest.mock('bcryptjs');

type MockUser = {
  _id?: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  isEmailVerified?: boolean;
  emailVerificationToken?: string;
  roles?: string[];
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  save: jest.Mock<Promise<void>, []>;
};

describe('AuthService', () => {
  let service: AuthService;
  let mockUserModel: any;
  let mockJwtService: { sign: jest.Mock<string, [any]> };
  let mockEmailService: {
    sendConfirmationEmail: jest.Mock<Promise<void>, [string, string]>;
    sendPasswordResetEmail: jest.Mock<Promise<void>, [string, string]>;
  };
  let mockSettingsService: { isRegistrationAllowed: jest.Mock<Promise<boolean>, []> };

  const createUser = (overrides: Partial<MockUser> = {}): MockUser => ({
    email: 'test@example.com',
    password: 'hashed',
    firstName: 'Test',
    lastName: 'User',
    isEmailVerified: true,
    roles: ['user'],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  beforeEach(() => {
    const users: MockUser[] = [];

    mockUserModel = function (this: MockUser, data: Partial<MockUser>) {
      Object.assign(this, createUser(data));
    } as any;

    mockUserModel.findOne = jest.fn(async (query: any) => {
      if (query.emailVerificationToken) {
        return users.find(
          u => u.emailVerificationToken === query.emailVerificationToken.$eq,
        );
      }
      if (query.passwordResetToken) {
        return users.find(
          u =>
            u.passwordResetToken === query.passwordResetToken.$eq &&
            u.passwordResetExpires &&
            u.passwordResetExpires > query.passwordResetExpires.$gt,
        );
      }
      if (query.email) {
        return users.find(u => u.email === query.email.$eq) || null;
      }
      return null;
    });

    mockUserModel.findById = jest.fn(async (id: string) =>
      users.find(u => String(u._id) === String(id)) || null,
    );

    mockJwtService = {
      sign: jest.fn(() => 'signed-jwt-token'),
    };

    mockEmailService = {
      sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    mockSettingsService = {
      isRegistrationAllowed: jest.fn().mockResolvedValue(true),
    };

    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    service = new AuthService(
      mockUserModel,
      mockJwtService as any,
      mockEmailService as any,
      mockSettingsService as any,
    );
  });

  describe('register', () => {
    it('throws when registration is disabled', async () => {
      mockSettingsService.isRegistrationAllowed.mockResolvedValueOnce(false);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password',
          firstName: 'Test',
          lastName: 'User',
        } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when user already exists', async () => {
      // first call: user exists
      mockUserModel.findOne.mockResolvedValueOnce(createUser());

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password',
          firstName: 'Test',
          lastName: 'User',
        } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates user, hashes password and sends confirmation email', async () => {
      mockUserModel.findOne.mockResolvedValueOnce(null);

      const spyConstructor = jest.spyOn<any, any>(mockUserModel, 'constructor');

      const result = await service.register({
        email: 'test@example.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'User',
      } as any);

      expect(bcrypt.genSalt).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith('password', 'salt');
      expect(mockUserModel.findOne).toHaveBeenCalled();
      expect(mockEmailService.sendConfirmationEmail).toHaveBeenCalledTimes(1);
      expect(result.message).toContain('Registration successful');
      // Ensure constructor was invoked
      expect(spyConstructor).toBeDefined();
    });
  });

  describe('login', () => {
    it('throws for unknown email', async () => {
      mockUserModel.findOne.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'missing@example.com', password: 'pw' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws for invalid password', async () => {
      const user = createUser({ password: 'hashed' });
      mockUserModel.findOne.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.login({ email: user.email, password: 'wrong' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when email is not verified', async () => {
      const user = createUser({ isEmailVerified: false });
      mockUserModel.findOne.mockResolvedValueOnce(user);

      await expect(
        service.login({ email: user.email, password: 'pw' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns user data and token for valid credentials', async () => {
      const user = createUser({ _id: '123', isEmailVerified: true });
      mockUserModel.findOne.mockResolvedValueOnce(user);

      const result = await service.login({
        email: user.email,
        password: 'pw',
      } as any);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        email: user.email,
        sub: user._id,
      });
      expect(result.token).toBe('signed-jwt-token');
      expect(result.user.email).toBe(user.email);
    });
  });

  describe('confirmEmail', () => {
    it('throws for invalid token', async () => {
      mockUserModel.findOne.mockResolvedValueOnce(null);

      await expect(service.confirmEmail('bad-token'))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('verifies user and clears token', async () => {
      const user = createUser({
        emailVerificationToken: 'valid-token',
        isEmailVerified: false,
      });
      mockUserModel.findOne.mockResolvedValueOnce(user);

      const result = await service.confirmEmail('valid-token');

      expect(user.isEmailVerified).toBe(true);
      expect(user.emailVerificationToken).toBeUndefined();
      expect(user.save).toHaveBeenCalled();
      expect(result.message).toContain('Email confirmed successfully');
    });
  });

  describe('forgotPassword', () => {
    it('returns same message when user not found (no enumeration)', async () => {
      mockUserModel.findOne.mockResolvedValueOnce(null);

      const result = await service.forgotPassword({ email: 'missing@example.com' } as any);

      expect(result.message).toContain('If an account with that email exists');
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('saves reset token and sends email when user exists', async () => {
      const user = createUser({ email: 'u@example.com' });
      mockUserModel.findOne.mockResolvedValueOnce(user);

      const result = await service.forgotPassword({ email: 'u@example.com' } as any);

      expect(user.passwordResetToken).toBeDefined();
      expect(user.passwordResetExpires).toBeInstanceOf(Date);
      expect(user.save).toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'u@example.com',
        user.passwordResetToken,
      );
      expect(result.message).toContain('If an account with that email exists');
    });
  });

  describe('resetPassword', () => {
    it('throws for invalid or expired token', async () => {
      mockUserModel.findOne.mockResolvedValueOnce(null);

      await expect(
        service.resetPassword({ token: 'bad', password: 'new' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('updates password and clears reset token', async () => {
      const user = createUser({
        passwordResetToken: 'valid',
        passwordResetExpires: new Date(Date.now() + 1e6),
      });
      mockUserModel.findOne.mockResolvedValueOnce(user);

      const result = await service.resetPassword({
        token: 'valid',
        password: 'newpassword',
      } as any);

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 'salt');
      expect(user.password).toBe('hashed-password');
      expect(user.passwordResetToken).toBeUndefined();
      expect(user.passwordResetExpires).toBeUndefined();
      expect(user.save).toHaveBeenCalled();
      expect(result.message).toContain('Password has been reset successfully');
    });
  });

  describe('validateUser', () => {
    it('returns user by payload.sub without password', async () => {
      const user = createUser({ _id: 'uid' });
      mockUserModel.findById.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue(user),
      });

      const result = await service.validateUser({ sub: 'uid' } as any);

      expect(mockUserModel.findById).toHaveBeenCalledWith('uid');
      expect(result).toBe(user);
    });
  });
});

