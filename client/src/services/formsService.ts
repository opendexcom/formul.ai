import { apiClient } from './apiClient';
import { getErrorMessage } from '../utils/errorHandling';
import { AnalyticsData, ResponseWithMetadata } from '../types/analytics';

export interface FormData {
  _id?: string;
  title: string;
  description?: string;
  questions: Question[];
  isActive: boolean;
  isPublic: boolean;
  createdAt?: string;
  updatedAt?: string;
  settings: FormSettings;
}

export interface Question {
  id: string;
  title: string;
  description?: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  order: number;
  validation?: Record<string, ValidationRule>;
}

export enum QuestionType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  MULTIPLE_CHOICE = 'multiple_choice',
  CHECKBOX = 'checkbox',
  DROPDOWN = 'dropdown',
  EMAIL = 'email',
  NUMBER = 'number',
  DATE = 'date',
  TIME = 'time',
  RATING = 'rating',
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'email' | 'minLength' | 'maxLength';
  value?: string | number;
  message?: string;
}

export interface FormSettings {
  allowMultipleResponses: boolean;
  requireLogin: boolean;
  showProgressBar: boolean;
  customTheme?: {
    primaryColor?: string;
    backgroundColor?: string;
    fontFamily?: string;
  };
}

export interface CreateFormRequest {
  title: string;
  description?: string;
  questions?: Question[];
  settings?: Partial<FormSettings>;
}

export interface FormStats {
  formId: string;
  totalResponses: number;
  lastResponse: string | null;
  isActive: boolean;
  isPublic: boolean;
}

class FormsService {
  private api = apiClient;

  async getForms(): Promise<FormData[]> {
    try {
      const response = await this.api.get<FormData[]>('/forms');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async getForm(id: string): Promise<FormData> {
    try {
      const response = await this.api.get<FormData>(`/forms/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async createForm(formData: CreateFormRequest): Promise<FormData> {
    try {
      const response = await this.api.post<FormData>('/forms', formData);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async updateForm(id: string, formData: Partial<FormData>): Promise<FormData> {
    try {
      // The backend will handle filtering out system fields, so we just send the data
      const response = await this.api.patch<FormData>(`/forms/${id}`, formData);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async deleteForm(id: string): Promise<void> {
    try {
      await this.api.delete(`/forms/${id}`);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async getFormStats(id: string): Promise<FormStats> {
    try {
      const response = await this.api.get<FormStats>(`/forms/${id}/stats`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async toggleFormActive(id: string): Promise<FormData> {
    try {
      const response = await this.api.patch<FormData>(`/forms/${id}/toggle-active`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async getResponseCount(id: string): Promise<number> {
    try {
      const response = await this.api.get<{ count: number }>(`/forms/${id}/response-count`);
      return response.data.count;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async getFormAnalytics(id: string, forceRefresh: boolean = false): Promise<AnalyticsData> {
    try {
      const url = `/forms/${id}/analytics${forceRefresh ? '?refresh=true' : ''}`;
      const response = await this.api.get<AnalyticsData>(url);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async refreshFormAnalytics(id: string): Promise<{ taskId: string; message: string }> {
    try {
      const response = await this.api.post<{ taskId: string; message: string }>(`/forms/${id}/analytics/refresh`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async reprocessAllResponses(id: string, onlyFailed: boolean = true): Promise<{ taskId: string; message: string }> {
    try {
      const url = `/forms/${id}/responses/reprocess-all${onlyFailed ? '?onlyFailed=true' : ''}`;
      const response = await this.api.post<{ taskId: string; message: string }>(url);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async getFormResponses(id: string, filters?: {
    sentiment?: 'positive' | 'neutral' | 'negative' | 'ambivalent';
    topics?: string;
    representativeness?: 'typical' | 'deviant' | 'mixed';
    depth?: 'superficial' | 'moderate' | 'deep';
    minSentimentScore?: number;
    maxSentimentScore?: number;
  }): Promise<ResponseWithMetadata[]> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, String(value));
          }
        });
      }
      const url = `/forms/${id}/responses${params.toString() ? '?' + params.toString() : ''}`;
      const response = await this.api.get<ResponseWithMetadata[]>(url);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

const formsService = new FormsService();
export default formsService;