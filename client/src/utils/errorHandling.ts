import { AxiosError } from 'axios';

/**
 * Extracts a user-friendly error message from various error types
 */
export const getErrorMessage = (error: unknown): string => {
  if (AxiosError.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; error?: string }>;
    
    // Try to extract message from response
    if (axiosError.response?.data) {
      const data = axiosError.response.data;
      if (typeof data === 'string') {
        return data;
      }
      if (data.message) {
        return data.message;
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
  return AxiosError.isAxiosError(error);
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

