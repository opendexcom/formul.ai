import axios, { AxiosError } from 'axios';

/** Response body shape for NestJS validation (400) and other API errors */
interface ApiErrorData {
  message?: string | string[];
  error?: string;
}

/**
 * Normalizes API error message (NestJS sends validation errors as message: string[]).
 * Strips trailing periods from each segment and joins with ". " so single- and multi-element
 * arrays are handled consistently (no trailing period kept only for single errors).
 */
function normalizeMessage(message: string | string[]): string {
  if (!Array.isArray(message)) return message;
  const segments = message.map((m) =>
    typeof m === 'string' ? m.replace(/\.+$/, '').trim() : String(m),
  );
  return segments.join('. ');
}

/**
 * Extracts a user-friendly error message from various error types
 */
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorData>;

    // Try to extract message from response (e.g. 400 validation from backend)
    if (axiosError.response?.data) {
      const data = axiosError.response.data;
      if (typeof data === 'string') {
        return data;
      }
      if (data.message !== undefined && data.message !== null) {
        return normalizeMessage(data.message);
      }
      if (data.error) {
        return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      }
    }

    // Fall back to axios error message
    if (axiosError.message) {
      return axiosError.message;
    }

    // Network errors
    if (axiosError.code === 'ERR_NETWORK') {
      return 'Network error. Please check your connection.';
    }

    // Timeout errors
    if (axiosError.code === 'ECONNABORTED') {
      return 'Request timeout. Please try again.';
    }

    // Status code based messages
    const status = axiosError.response?.status;
    if (status === 401) {
      return 'Authentication required. Please log in.';
    }
    if (status === 403) {
      return 'You do not have permission to perform this action.';
    }
    if (status === 404) {
      return 'The requested resource was not found.';
    }
    if (status === 500) {
      return 'Server error. Please try again later.';
    }

    return `Request failed: ${status ? `Status ${status}` : 'Unknown error'}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred';
};

/**
 * Checks if an error is an axios error
 */
export const isAxiosError = (error: unknown): error is AxiosError => {
  return axios.isAxiosError(error);
};

/**
 * Checks if an error is a network error
 */
export const isNetworkError = (error: unknown): boolean => {
  if (isAxiosError(error)) {
    return error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED';
  }
  return false;
};

