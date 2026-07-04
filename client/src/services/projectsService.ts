import { apiClient } from './apiClient';
import { getErrorMessage } from '../utils/errorHandling';
import { FormData } from './formsService';
import type {
  ComparativeReport,
  ComparativeReportReadiness,
  PaginatedProjectResponses,
  SplitQuestionnaireDesign,
  VariantKey,
} from '../types/comparative-report';
import type { StudyAnalysisResponse } from '../types/study-analysis';

export interface ProjectVariant {
  key: 'main' | 'A' | 'B';
  formId: string;
  targetGroup?: { name: string; description?: string };
  internalDescription?: string;
}

export interface ProjectData {
  _id: string;
  name: string;
  hypothesis?: string;
  hypotheses?: string[];
  researchNotes?: string;
  type: 'single' | 'ab_test';
  status:
    | 'draft'
    | 'designing'
    | 'published'
    | 'collecting'
    | 'analyzing'
    | 'analyzed'
    | 'reported'
    | 'completed'
    | 'archived';
  variants: ProjectVariant[];
  researchDesignType?: 'standard_ab' | 'split_questionnaire';
  splitQuestionnaireDesign?: SplitQuestionnaireDesign;
  createdAt?: string;
  updatedAt?: string;
  responseCount?: number;
}

export interface CreateProjectRequest {
  name: string;
  hypothesis?: string;
  type?: 'single' | 'ab_test';
}

export interface AddProjectVariantRequest {
  key?: 'A' | 'B';
  targetGroupName?: string;
  cloneFromKey?: 'main' | 'A' | 'B';
  excludeQuestionIds?: string[];
  modifiedQuestionIds?: string[];
  polarityFlippedQuestionIds?: string[];
}

export interface UpdateProjectRequest {
  name?: string;
  hypothesis?: string;
  hypotheses?: string[];
  researchNotes?: string;
}

export interface UpdateProjectVariantRequest {
  internalDescription?: string;
  targetGroupName?: string;
}

export type DashboardStudySummary = {
  _id: string;
  name: string;
  hypothesis?: string;
  type: 'single' | 'ab_test';
  status: ProjectData['status'];
  responseCount: number;
  responsesThisWeek: number;
  aiStatus: 'ready' | 'needs_data' | 'reported' | 'analyzing' | 'not_started';
  updatedAt?: string;
  createdAt?: string;
};

export interface DashboardSummary {
  totalStudies: number;
  activeStudies: number;
  totalResponses: number;
  responsesLast7Days: number;
  responsesPrev7Days: number;
  aiAnalysesReady: number;
  abTestsRunning: number;
  studies: DashboardStudySummary[];
}

class ProjectsService {
  private api = apiClient;

  async getProjects(): Promise<ProjectData[]> {
    try {
      const response = await this.api.get<ProjectData[]>('/projects');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    try {
      const response = await this.api.get<DashboardSummary>('/projects/dashboard-summary');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async getProject(id: string): Promise<ProjectData> {
    try {
      const response = await this.api.get<ProjectData>(`/projects/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async createProject(payload: CreateProjectRequest): Promise<ProjectData> {
    try {
      const response = await this.api.post<ProjectData>('/projects', payload);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async addVariant(id: string, payload: AddProjectVariantRequest = {}): Promise<ProjectData> {
    try {
      const response = await this.api.post<ProjectData>(`/projects/${id}/variants`, payload);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async updateProject(id: string, payload: UpdateProjectRequest): Promise<ProjectData> {
    try {
      const response = await this.api.patch<ProjectData>(`/projects/${id}`, payload);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async updateVariant(
    projectId: string,
    variantKey: 'main' | 'A' | 'B',
    payload: UpdateProjectVariantRequest,
  ): Promise<ProjectData> {
    try {
      const response = await this.api.patch<ProjectData>(
        `/projects/${projectId}/variants/${variantKey}`,
        payload,
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  normalizeHypotheses(project: Pick<ProjectData, 'hypothesis' | 'hypotheses'>): string[] {
    const fromArray = (project.hypotheses ?? []).map((item) => item.trim()).filter(Boolean);
    if (fromArray.length > 0) {
      return fromArray;
    }
    if (project.hypothesis?.trim()) {
      return [project.hypothesis.trim()];
    }
    return [];
  }

  async archiveProject(id: string): Promise<ProjectData> {
    try {
      const response = await this.api.patch<ProjectData>(`/projects/${id}/archive`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async getProjectResponses(
    id: string,
    params?: { page?: number; limit?: number; variant?: VariantKey },
  ): Promise<PaginatedProjectResponses> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.variant) searchParams.set('variant', params.variant);
      const query = searchParams.toString();
      const response = await this.api.get<PaginatedProjectResponses>(
        `/projects/${id}/responses${query ? `?${query}` : ''}`,
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async getComparativeReportReadiness(id: string): Promise<ComparativeReportReadiness> {
    try {
      const response = await this.api.get<ComparativeReportReadiness>(
        `/projects/${id}/comparative-report/readiness`,
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async getComparativeReport(id: string): Promise<{
    projectId: string;
    comparativeReport: ComparativeReport | null;
    readiness: ComparativeReportReadiness;
  }> {
    try {
      const response = await this.api.get(`/projects/${id}/comparative-report`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async streamComparativeReport(
    projectId: string,
    onEvent: (event: Record<string, unknown>) => void,
    existingTaskId?: string | null,
  ): Promise<() => void> {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const params = new URLSearchParams();
    if (existingTaskId) {
      params.append('taskId', existingTaskId);
    }

    const url = `/api/projects/${projectId}/comparative-report/stream${
      params.toString() ? `?${params.toString()}` : ''
    }`;

    const controller = new AbortController();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to start comparative report stream (${response.status})`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    void (async () => {
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as Record<string, unknown>;
            onEvent(payload);
            if (payload.taskId && payload.type === 'connected') {
              sessionStorage.setItem(
                `comparative-report-task-${projectId}`,
                String(payload.taskId),
              );
            }
          } catch {
            // ignore malformed events
          }
        }
      }
    })();

    return () => controller.abort();
  }

  async getStudyAnalysis(id: string): Promise<StudyAnalysisResponse> {
    try {
      const response = await this.api.get<StudyAnalysisResponse>(`/projects/${id}/analytics`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async streamStudyAnalysis(
    projectId: string,
    onEvent: (event: Record<string, unknown>) => void,
    existingTaskId?: string | null,
  ): Promise<void> {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const params = new URLSearchParams();
    if (existingTaskId) {
      params.append('taskId', existingTaskId);
    }

    const url = `/api/projects/${projectId}/analytics/stream${
      params.toString() ? `?${params.toString()}` : ''
    }`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to start study analysis stream (${response.status})`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const payload = JSON.parse(line.slice(6)) as Record<string, unknown>;
          onEvent(payload);
          if (payload.taskId && payload.type === 'connected') {
            sessionStorage.setItem(`study-analysis-task-${projectId}`, String(payload.taskId));
          }
        } catch {
          // ignore malformed events
        }
      }
    }
  }

  /** @deprecated Use getStudyAnalysis */
  async getProjectAnalytics(id: string): Promise<StudyAnalysisResponse> {
    return this.getStudyAnalysis(id);
  }

  /** @deprecated Use streamStudyAnalysis */
  async refreshProjectAnalytics(id: string): Promise<{ projectId: string; taskId: string; status: string }> {
    try {
      const response = await this.api.post<{ projectId: string; taskId: string; status: string }>(
        `/projects/${id}/analytics`,
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  getInsightsVariant(project: ProjectData): ProjectVariant | undefined {
    return project.variants.find((variant) => variant.key === 'main') ?? project.variants[0];
  }

  getVariantByKey(project: ProjectData, key: string): ProjectVariant | undefined {
    return project.variants.find((variant) => variant.key === key);
  }

  getMainVariantFormId(project: ProjectData): string | undefined {
    return this.getInsightsVariant(project)?.formId;
  }
}

const projectsService = new ProjectsService();
export default projectsService;
export type { FormData };
