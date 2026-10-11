import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { handleUnauthorizedResponse } from '../utils/authSession';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const AUTH_CREDENTIAL_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-email',
  '/auth/forgot-password',
  '/auth/reset-password',
];

export function isAuthCredentialRequest(url?: string): boolean {
  if (!url) {
    return false;
  }
  return AUTH_CREDENTIAL_PATHS.some((path) => url.includes(path));
}

/**
 * Creates a configured axios instance with request/response interceptors
 * Handles authentication tokens and 401 responses globally
 */
export const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor: Add auth token to requests
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = localStorage.getItem('token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor: Handle 401 errors globally, except credential checks
  // (login/register/etc.) so a failed Sign In does not clear the form or session.
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401 && !isAuthCredentialRequest(error.config?.url)) {
        handleUnauthorizedResponse();
      }
      return Promise.reject(error);
    }
  );

  // Settings API
  (client as any).getRegistrationSetting = async (): Promise<{
    allowRegistration: boolean;
  }> => {
    const response = await client.get<{ allowRegistration: boolean }>('/settings/registration');
    return response.data;
  };

  (client as any).updateRegistrationSetting = async (allowRegistration: boolean): Promise<{ allowRegistration: boolean }> => {
    const response = await client.put<{ allowRegistration: boolean }>('/settings/registration', { allowRegistration });
    return response.data;
  };

  return client;
};

// Export a default instance
export const apiClient = createApiClient();

