import { getUserIdFromToken, isTokenExpired } from '../utils/jwtUtils';
import { apiClient } from './apiClient';
import { getErrorMessage } from '../utils/errorHandling';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  token: string;
}

class AuthService {
  private api = apiClient;

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await this.api.post<AuthResponse>('/auth/login', credentials);
      const { user, token } = response.data;
      
      // Store token in localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await this.api.post<AuthResponse>('/auth/register', userData);
      const { user, token } = response.data;
      
      // Store token in localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  getCurrentUserId(): string | null {
    const token = this.getToken();
    return token ? getUserIdFromToken(token) : null;
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    
    // Check if token is expired
    if (isTokenExpired(token)) {
      this.logout(); // Clean up expired token
      return false;
    }
    
    return true;
  }
}

const authService = new AuthService();
export default authService;