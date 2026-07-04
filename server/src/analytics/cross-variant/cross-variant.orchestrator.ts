import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from '../../schemas/project.schema';
import { Form, FormDocument } from '../../schemas/form.schema';
import { Response, ResponseDocument } from '../../schemas/response.schema';
import { ProgressService } from '../queues/progress.service';
import { VariantQuestionDiffService } from '../../projects/variant-question-diff.service';
import {
  ComparativeReport,
  ComparativeReportReadiness,
  SplitQuestionnaireDesign,
  VariantContextSnapshot,
  VariantKey,
} from '../../projects/comparative-report.types';
import { CrossVariantTopicAligner } from './cross-variant-topic-aligner';
import {
  CrossVariantMetricsService,
  VariantAnalyticsBundle,
} from './cross-variant-metrics.service';
import { CrossVariantCorrelationsService } from './cross-variant-correlations.service';
import { CrossVariantReportGenerator } from './cross-variant-report.generator';

@Injectable()
export class CrossVariantOrchestrator {
  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(Form.name) private readonly formModel: Model<FormDocument>,
    @InjectModel(Response.name) private readonly responseModel: Model<ResponseDocument>,
    private readonly questionDiffService: VariantQuestionDiffService,
    private readonly topicAligner: CrossVariantTopicAligner,
    private readonly metricsService: CrossVariantMetricsService,
    private readonly correlationsService: CrossVariantCorrelationsService,
    private readonly reportGenerator: CrossVariantReportGenerator,
    private readonly progressService: ProgressService,
  ) {}

  async checkReadiness(projectId: string, userId: string): Promise<ComparativeReportReadiness> {
    const project = await this.loadProject(projectId, userId);
    const variants = await Promise.all(
      project.variants.map(async (variant) => {
        const form = await this.formModel.findById(variant.formId).lean();
        const responseCount = await this.responseModel.countDocuments({
          formId: variant.formId,
        });
        const hasAnalytics = Boolean(
          form?.analytics?.lastUpdated &&
            (form.analytics.totalResponsesAnalyzed ?? 0) > 0,
        );
        return {
          key: variant.key as VariantKey,
          formId: String(variant.formId),
          hasAnalytics,
          responseCount,
          analyticsGeneratedAt: form?.analytics?.lastUpdated
            ? new Date(form.analytics.lastUpdated).toISOString()
            : undefined,
        };
      }),
    );

    const requiresMultipleVariants = project.variants.length < 2;
    const ready =
      !requiresMultipleVariants && variants.every((variant) => variant.hasAnalytics);

    return {
      ready,
      variantCount: project.variants.length,
      requiresMultipleVariants,
      variants,
    };
  }

  async getComparativeReport(
    projectId: string,
    userId: string,
  ): Promise<{ projectId: string; comparativeReport: ComparativeReport | null; readiness: ComparativeReportReadiness }> {
    const project = await this.loadProject(projectId, userId);
    const readiness = await this.checkReadiness(projectId, userId);
    return {
      projectId: String(project._id),
      comparativeReport: (project.comparativeReport as ComparativeReport | undefined) ?? null,
      readiness,
    };
  }

  async generateComparativeReport(
    projectId: string,
    userId: string,
    taskId: string,
  ): Promise<ComparativeReport> {
    const publish = async (progress: number, message: string, type: 'progress' | 'complete' | 'error' = 'progress') => {
      await this.progressService.publishProgress({
        taskId,
        type,
        message,
        progress,
      });
    };

    try {
      await publish(0, 'Validating prerequisites...');
      const readiness = await this.checkReadiness(projectId, userId);
      if (readiness.requiresMultipleVariants) {
        throw new BadRequestException('At least two variants are required for comparative analysis.');
      }
      if (!readiness.ready) {
        const missing = readiness.variants
          .filter((variant) => !variant.hasAnalytics)
          .map((variant) => variant.key)
          .join(', ');
        throw new BadRequestException(
          `Per-variant analytics required before generating comparative report. Missing: ${missing}`,
        );
      }

      const project = await this.loadProject(projectId, userId);
      project.comparativeReport = {
        status: 'generating',
        generatedAt: new Date(),
        cacheVersion: 1,
      } as unknown as Record<string, unknown>;
      project.status = 'analyzing';
      await project.save();

      await publish(10, 'Analyzing question differences across variants...');
      const bundles = await this.loadBundles(project);
      const questionDiff = this.questionDiffService.diffVariantQuestions(
        bundles.map((bundle) => ({
          key: bundle.key,
          questions: bundle.form.questions ?? [],
        })),
      );

      const variantContext: VariantContextSnapshot[] = bundles.map((bundle) => ({
        key: bundle.key,
        formId: String(bundle.formId),
        targetGroupName: bundle.variant.targetGroup?.name,
        internalDescription: bundle.variant.internalDescription,
        responseCount: bundle.responseCount,
        analyticsGeneratedAt: bundle.form.analytics?.lastUpdated
          ? new Date(bundle.form.analytics.lastUpdated).toISOString()
          : undefined,
      }));

      await publish(25, 'Aligning topics across variants...');
      const topicInputs = bundles.map((bundle) => ({
        key: bundle.key,
        topTopics: bundle.form.analytics?.topics?.topTopics?.slice(0, 12) ?? [],
        topicFrequencies: Object.fromEntries(
          Object.entries(bundle.form.analytics?.topics?.distribution ?? {}).map(
            ([topic, data]) => [topic, (data as { count: number }).count ?? 0],
          ),
        ),
      }));
      const { groups: alignedTopics, notes: alignmentNotes } =
        await this.topicAligner.alignTopics(topicInputs);

      await publish(45, 'Comparing metrics and correlations...');
      const metricComparison = this.metricsService.buildMetricComparison(
        bundles,
        alignedTopics,
        questionDiff.sharedQuestionIds,
      );
      const citations = await this.correlationsService.collectCitations(bundles);
      const correlations = this.metricsService.buildCorrelationSummaries(bundles, citations);

      await publish(65, 'Evaluating hypotheses and synthesizing report...');
      const reportBody = await this.reportGenerator.generateReport({
        projectName: project.name,
        hypotheses:
          project.hypotheses?.length > 0
            ? project.hypotheses
            : project.hypothesis
              ? [project.hypothesis]
              : [],
        researchNotes: project.researchNotes,
        researchDesignType: project.researchDesignType,
        splitQuestionnaireDesign: project.splitQuestionnaireDesign as
          | SplitQuestionnaireDesign
          | undefined,
        questionDiff,
        variantContext,
        bundles,
        alignedTopics,
        alignmentNotes,
        metricComparison,
        citations,
        correlations,
      });

      const splitDesignSnapshot = project.splitQuestionnaireDesign
        ? JSON.parse(JSON.stringify(project.splitQuestionnaireDesign))
        : undefined;

      const comparativeReport: ComparativeReport = {
        generatedAt: new Date(),
        status: 'complete',
        cacheVersion: 1,
        questionDiff,
        variantContext,
        executiveSummary: reportBody.executiveSummary,
        variantSections: reportBody.variantSections,
        crossVariantInsights: reportBody.crossVariantInsights,
        hypothesisEvaluation: reportBody.hypothesisEvaluation,
        correlations,
        splitQuestionnaireDesign: splitDesignSnapshot,
        closedQuestionComparison: metricComparison.closedQuestionComparison,
        methodology: {
          comparableQuestionIds: questionDiff.sharedQuestionIds,
          topicAlignmentNotes: alignmentNotes,
          limitations: questionDiff.sharedQuestionIds.length === 0
            ? ['No shared questions across variants; quantitative comparison is limited.']
            : undefined,
        },
      };

      project.comparativeReport = comparativeReport as unknown as Record<string, unknown>;
      project.status = 'reported';
      project.report = {
        generatedAt: new Date(),
        summary: reportBody.executiveSummary.slice(0, 500),
      };
      await project.save();

      await publish(100, 'Comparative report complete.', 'complete');
      return comparativeReport;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Comparative report generation failed';
      await publish(0, message, 'error');
      await this.projectModel.findByIdAndUpdate(projectId, {
        $set: {
          'comparativeReport.status': 'error',
          'comparativeReport.error': message,
          'comparativeReport.generatedAt': new Date(),
        },
      });
      throw error;
    }
  }

  private async loadProject(projectId: string, userId: string): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(projectId).exec();
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    if (project.ownerId.toString() !== userId.toString()) {
      throw new BadRequestException('Access denied');
    }
    return project;
  }

  private async loadBundles(project: ProjectDocument): Promise<VariantAnalyticsBundle[]> {
    return Promise.all(
      project.variants.map(async (variant) => {
        const form = await this.formModel.findById(variant.formId).exec();
        if (!form) {
          throw new BadRequestException(`Form not found for variant ${variant.key}`);
        }
        const responseCount = await this.responseModel.countDocuments({
          formId: variant.formId,
        });
        return {
          key: variant.key as VariantKey,
          formId: variant.formId as Types.ObjectId,
          form,
          variant,
          responseCount,
        };
      }),
    );
  }
}
