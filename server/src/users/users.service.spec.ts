import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserModel: {
    findById: jest.Mock;
  };

  const userId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    mockUserModel = {
      findById: jest.fn(),
    };
    service = new UsersService(mockUserModel as any);
  });

  describe('getProfile', () => {
    it('returns profile without password', async () => {
      const user = {
        _id: userId,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roles: ['user'],
        isEmailVerified: true,
        createdAt: new Date('2024-01-01'),
      };
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      const result = await service.getProfile(userId);

      expect(result).toEqual({
        id: userId,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roles: ['user'],
        isEmailVerified: true,
        createdAt: user.createdAt,
      });
    });

    it('throws when user not found', async () => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(service.getProfile(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('updates first and last name', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const user = {
        _id: userId,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roles: ['user'],
        isEmailVerified: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        save,
      };
      mockUserModel.findById.mockResolvedValue(user);

      const result = await service.updateProfile(userId, {
        firstName: 'Jane',
        lastName: 'Smith',
      });

      expect(user.firstName).toBe('Jane');
      expect(user.lastName).toBe('Smith');
      expect(save).toHaveBeenCalled();
      expect(result.firstName).toBe('Jane');
      expect(result.lastName).toBe('Smith');
    });
  });

  describe('changePassword', () => {
    it('updates password when current password is valid', async () => {
      const hashed = await bcrypt.hash('OldP@ss1', 10);
      const save = jest.fn().mockResolvedValue(undefined);
      const user = {
        password: hashed,
        passwordResetToken: 'token',
        passwordResetExpires: new Date(),
        updatedAt: new Date(),
        save,
      };
      mockUserModel.findById.mockResolvedValue(user);

      const result = await service.changePassword(userId, {
        currentPassword: 'OldP@ss1',
        newPassword: 'NewP@ss1',
      });

      expect(result.message).toBe('Password updated successfully');
      expect(user.passwordResetToken).toBeUndefined();
      expect(user.passwordResetExpires).toBeUndefined();
      expect(save).toHaveBeenCalled();
      expect(await bcrypt.compare('NewP@ss1', user.password)).toBe(true);
    });

    it('throws when current password is incorrect', async () => {
      const hashed = await bcrypt.hash('OldP@ss1', 10);
      mockUserModel.findById.mockResolvedValue({
        password: hashed,
        save: jest.fn(),
      });

      await expect(
        service.changePassword(userId, {
          currentPassword: 'WrongP@ss1',
          newPassword: 'NewP@ss1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
