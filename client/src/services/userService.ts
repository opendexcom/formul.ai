import { apiClient } from './apiClient';
import { getErrorMessage } from '../utils/errorHandling';
import type { User } from '../types';

export interface UserProfile extends User {
  isEmailVerified: boolean;
  createdAt: string;
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

class UserService {
  private api = apiClient;

  async getProfile(): Promise<UserProfile> {
    try {
      const response = await this.api.get<UserProfile>('/users/me');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
    try {
      const response = await this.api.patch<UserProfile>('/users/me', data);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async changePassword(data: ChangePasswordRequest): Promise<{ message: string }> {
    try {
      const response = await this.api.put<{ message: string }>('/users/me/password', data);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

const userService = new UserService();
export default userService;
