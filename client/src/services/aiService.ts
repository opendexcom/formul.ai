import { apiClient } from './apiClient';
import { Question } from './formsService';
import { getErrorMessage } from '../utils/errorHandling';

export interface GeneratedForm {
  title: string;
  description: string;
  questions: Question[];
}

export interface GenerateAIFormResponse {
  form: GeneratedForm;
  usage?: { model?: string; promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

class AIService {
  private api = apiClient;

  /**
   * Generate a form based on user's description
   */
  async generateForm(userPrompt: string): Promise<GeneratedForm> {
    try {
      const response = await this.api.post<GenerateAIFormResponse>(
        '/ai/generate',
        { prompt: userPrompt, mode: 'generate' }
      );
      return response.data.form;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /**
   * Refine an existing form based on user feedback
   */
  async refineForm(currentForm: GeneratedForm, refinementPrompt: string): Promise<GeneratedForm> {
    try {
      const response = await this.api.post<GenerateAIFormResponse>(
        '/ai/generate',
        { prompt: refinementPrompt, mode: 'refine', currentForm }
      );
      return response.data.form;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean { 
    return true; 
  }
}

const aiService = new AIService();
export default aiService;
