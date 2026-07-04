import { Injectable } from '@nestjs/common';
import { CrossVariantOrchestrator } from '../analytics/cross-variant/cross-variant.orchestrator';
import { ProgressService } from '../analytics/queues/progress.service';

@Injectable()
export class ComparativeReportService {
  constructor(
    private readonly orchestrator: CrossVariantOrchestrator,
    private readonly progressService: ProgressService,
  ) {}

  checkReadiness(projectId: string, userId: string) {
    return this.orchestrator.checkReadiness(projectId, userId);
  }

  getComparativeReport(projectId: string, userId: string) {
    return this.orchestrator.getComparativeReport(projectId, userId);
  }

  generateComparativeReport(projectId: string, userId: string, taskId: string) {
    return this.orchestrator.generateComparativeReport(projectId, userId, taskId);
  }

  onProgress(callback: (update: unknown) => void) {
    return this.progressService.onProgress(callback);
  }
}
