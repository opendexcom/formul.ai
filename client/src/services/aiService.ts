import axios from 'axios';
import { Question } from './formsService';

export interface GeneratedForm {
  title: string;
  description: string;
  questions: Question[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

class AIService {
  /**
   * Generate a form based on user's description
   */
  async generateForm(userPrompt: string): Promise<GeneratedForm> {
    const token = localStorage.getItem('token');
    const res = await axios.post(
      `${API_BASE_URL}/ai/generate`,
      { prompt: userPrompt, mode: 'generate' },
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    return res.data as GeneratedForm;
  }

  /**
   * Refine an existing form based on user feedback
   */
  async refineForm(currentForm: GeneratedForm, refinementPrompt: string): Promise<GeneratedForm> {
    const token = localStorage.getItem('token');
    const res = await axios.post(
      `${API_BASE_URL}/ai/generate`,
      { prompt: refinementPrompt, mode: 'refine', currentForm },
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    return res.data as GeneratedForm;
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean { return true; }
}

const aiService = new AIService();
export default aiService;
