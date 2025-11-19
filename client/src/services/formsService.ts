import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

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
  validation?: Record<string, any>;
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
  private api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  constructor() {
    // Add token to requests if available
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  async getForms(): Promise<FormData[]> {
    const response = await this.api.get('/forms');
    return response.data;
  }

  async getForm(id: string): Promise<FormData> {
    const response = await this.api.get(`/forms/${id}`);
    return response.data;
  }

  async createForm(formData: CreateFormRequest): Promise<FormData> {
    const response = await this.api.post('/forms', formData);
    return response.data;
  }

  async updateForm(id: string, formData: Partial<FormData>): Promise<FormData> {
    // The backend will handle filtering out system fields, so we just send the data
    const response = await this.api.patch(`/forms/${id}`, formData);
    return response.data;
  }

  async deleteForm(id: string): Promise<void> {
    await this.api.delete(`/forms/${id}`);
  }

  async getFormStats(id: string): Promise<FormStats> {
    const response = await this.api.get(`/forms/${id}/stats`);
    return response.data;
  }

  async toggleFormActive(id: string): Promise<FormData> {
    const response = await this.api.patch(`/forms/${id}/toggle-active`);
    return response.data;
  }

  async getResponseCount(id: string): Promise<number> {
    const response = await this.api.get(`/forms/${id}/response-count`);
    return response.data.count;
  }

  async getFormAnalytics(id: string, forceRefresh: boolean = false): Promise<any> {
    const url = `/forms/${id}/analytics${forceRefresh ? '?refresh=true' : ''}`;
    const response = await this.api.get(url);
    return response.data;
  }

  async refreshFormAnalytics(id: string): Promise<any> {
    const response = await this.api.post(`/forms/${id}/analytics/refresh`);
    return response.data;
  }

  async reprocessAllResponses(id: string, onlyFailed: boolean = true): Promise<any> {
    const url = `/forms/${id}/responses/reprocess-all${onlyFailed ? '?onlyFailed=true' : ''}`;
    const response = await this.api.post(url);
    return response.data;
  }

  async getFormResponses(id: string, filters?: {
    sentiment?: 'positive' | 'neutral' | 'negative' | 'ambivalent';
    topics?: string;
    representativeness?: 'typical' | 'deviant' | 'mixed';
    depth?: 'superficial' | 'moderate' | 'deep';
    minSentimentScore?: number;
    maxSentimentScore?: number;
  }): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }
    const url = `/forms/${id}/responses${params.toString() ? '?' + params.toString() : ''}`;
    const response = await this.api.get(url);
    return response.data;
  }
}

const formsService = new FormsService();
export default formsService;