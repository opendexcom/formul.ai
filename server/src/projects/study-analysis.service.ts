import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from '../schemas/project.schema';
import { Form, FormDocument } from '../schemas/form.schema';
import { Response, ResponseDocument } from '../schemas/response.schema';
import { ProgressService } from '../analytics/queues/progress.service';
import { VariantQuestionDiffService } from './variant-question-diff.service';
import {
  CrossVariantMetricsService,
  VariantAnalyticsBundle,
} from '../analytics/cross-variant/cross-variant-metrics.service';
import { CrossVariantTopicAligner } from '../analytics/cross-variant/cross-variant-topic-aligner';
import { StudyAnalysisGenerator } from './study-analysis.generator';
import {
  SplitQuestionnaireDesign,
  VariantKey,
} from './comparative-report.types';
import {
  StudyAnalysis,
  StudyAnalysisBranchMetric,
  StudyAnalysisCoreQuestionMetric,
  StudyAnalysisReadiness,
  StudyAnalysisResponse,
  StudyAnalysisRolledUpMetrics,
} from './study-analysis.types';

@Injectable()
export class StudyAnalysisService {
  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(Form.name) private readonly formModel: Model<FormDocument>,
    @InjectModel(Response.name) private readonly responseModel: Model<ResponseDocument>,
    private readonly questionDiffService: VariantQuestionDiffService,
    private readonly topicAligner: CrossVariantTopicAligner,
    private readonly metricsService: CrossVariantMetricsService,
    private readonly studyAnalysisGenerator: StudyAnalysisGenerator,
    private readonly progressService: ProgressService,
  ) {}

  async getStudyAnalysis(projectId: string, userId: string): Promise<StudyAnalysisResponse> {
    const project = await this.loadProject(projectId, userId);
    const readiness = await this.checkReadiness(projectId, userId);
    const analytics = (project.analytics as StudyAnalysis | undefined) ?? null;
    return {
      projectId: String(project._id),
      readiness,
      analytics: analytics?.status === 'complete' ? analytics : analytics,
    };
  }

  async checkReadiness(projectId: string, userId: string): Promise<StudyAnalysisReadiness> {
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

    const activeVariants = variants.filter((v) => v.responseCount > 0);
    const missingAnalytics = activeVariants.filter((v) => !v.hasAnalytics);

    let ready = false;
    let message: string | undefined;

    if (activeVariants.length === 0) {
      message = 'Collect responses before running study analysis.';
    } else if (missingAnalytics.length > 0) {
      message = `Each branch must be analyzed before study synthesis. Missing: ${missingAnalytics.map((v) => v.key).join(', ')}`;
    } else {
      ready = true;
    }

    return { ready, message, variants };
  }

  async generateStudyAnalysis(
    projectId: string,
    userId: string,
    taskId: string,
  ): Promise<StudyAnalysis> {
    const publish = async (
      progress: number,
      message: string,
      type: 'progress' | 'complete' | 'error' = 'progress',
    ) => {
      await this.progressService.publishProgress({ taskId, type, message, progress });
    };

    try {
      await publish(0, 'Validating prerequisites...');
      const readiness = await this.checkReadiness(projectId, userId);
      if (!readiness.ready) {
        throw new BadRequestException(
          readiness.message ?? 'Study analysis prerequisites not met.',
        );
      }

      const project = await this.loadProject(projectId, userId);
      project.analytics = {
        status: 'generating',
        generatedAt: new Date(),
        cacheVersion: 1,
      } as unknown as Record<string, unknown>;
      project.status = 'analyzing';
      await project.save();

      await publish(15, 'Loading variant analytics...');
      const bundles = await this.loadBundles(project);
      const activeBundles = bundles.filter((b) => b.responseCount > 0);

      const questionDiff = this.questionDiffService.diffVariantQuestions(
        activeBundles.map((bundle) => ({
          key: bundle.key,
          questions: bundle.form.questions ?? [],
        })),
      );

      await publish(30, 'Building rolled-up metrics...');
      const topicInputs = activeBundles.map((bundle) => ({
        key: bundle.key,
        topTopics: bundle.form.analytics?.topics?.topTopics?.slice(0, 12) ?? [],
        topicFrequencies: Object.fromEntries(
          Object.entries(bundle.form.analytics?.topics?.distribution ?? {}).map(
            ([topic, data]) => [topic, (data as { count: number }).count ?? 0],
          ),
        ),
      }));
      const { groups: alignedTopics } = await this.topicAligner.alignTopics(topicInputs);

      const sharedIds =
        project.researchDesignType === 'split_questionnaire' &&
        project.splitQuestionnaireDesign?.coreQuestionIds?.length
          ? project.splitQuestionnaireDesign.coreQuestionIds.filter((id) =>
              questionDiff.sharedQuestionIds.includes(id),
            )
          : questionDiff.sharedQuestionIds;

      const metricComparison = this.metricsService.buildMetricComparison(
        activeBundles,
        alignedTopics,
        sharedIds.length > 0 ? sharedIds : questionDiff.sharedQuestionIds,
      );

      const rolledUpMetrics = this.buildRolledUpMetrics(
        project,
        activeBundles,
        questionDiff,
        metricComparison,
        alignedTopics,
      );

      await publish(55, 'Synthesizing study-level insights...');
      const hypotheses =
        project.hypotheses?.length > 0
          ? project.hypotheses
          : project.hypothesis
            ? [project.hypothesis]
            : [];

      const variantContext = activeBundles.map((bundle) => ({
        key: bundle.key,
        targetGroupName: bundle.variant.targetGroup?.name,
        responseCount: bundle.responseCount,
      }));

      const synthesis = await this.studyAnalysisGenerator.generateStudyAnalysis({
        projectName: project.name,
        hypotheses,
        researchNotes: project.researchNotes,
        researchDesignType: project.researchDesignType,
        splitQuestionnaireDesign: project.splitQuestionnaireDesign as
          | SplitQuestionnaireDesign
          | undefined,
        questionDiff,
        metricComparison,
        bundles: activeBundles,
        rolledUpMetrics,
        variantContext,
      });

      const studyAnalysis: StudyAnalysis = {
        status: 'complete',
        generatedAt: new Date(),
        cacheVersion: 1,
        executiveSummary: synthesis.executiveSummary,
        hypothesisEvaluation: synthesis.hypothesisEvaluation,
        studyInsights: synthesis.studyInsights,
        rolledUpMetrics,
      };

      project.analytics = studyAnalysis as unknown as Record<string, unknown>;
      project.status = 'analyzed';
      project.report = {
        generatedAt: new Date(),
        summary: synthesis.executiveSummary.slice(0, 500),
      };
      await project.save();

      await publish(100, 'Study analysis complete.', 'complete');
      return studyAnalysis;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Study analysis failed';
      await publish(0, message, 'error');
      await this.projectModel.findByIdAndUpdate(projectId, {
        $set: {
          'analytics.status': 'error',
          'analytics.error': message,
          'analytics.generatedAt': new Date(),
        },
      });
      throw error;
    }
  }

  onProgress(callback: (update: unknown) => void) {
    return this.progressService.onProgress(callback);
  }

  private buildRolledUpMetrics(
    project: ProjectDocument,
    bundles: VariantAnalyticsBundle[],
    questionDiff: ReturnType<VariantQuestionDiffService['diffVariantQuestions']>,
    metricComparison: ReturnType<CrossVariantMetricsService['buildMetricComparison']>,
    alignedTopics: Array<{ unifiedLabel: string; perVariant: Array<{ key: VariantKey; frequency: number }> }>,
  ): StudyAnalysisRolledUpMetrics {
    const isSplit = project.researchDesignType === 'split_questionnaire';
    const coreIds = new Set(
      isSplit && project.splitQuestionnaireDesign?.coreQuestionIds?.length
        ? project.splitQuestionnaireDesign.coreQuestionIds
        : questionDiff.sharedQuestionIds,
    );

    const variantMetrics = bundles.map((bundle) => {
      const overall = bundle.form.analytics?.sentiment?.overall;
      return {
        key: bundle.key,
        responseCount: bundle.responseCount,
        topTopics: bundle.form.analytics?.topics?.topTopics?.slice(0, 8) ?? [],
        sentiment: {
          positive: overall?.positive ?? 0,
          neutral: overall?.neutral ?? 0,
          negative: overall?.negative ?? 0,
        },
      };
    });

    const dominantTopics = this.mergeDominantTopics(bundles, isSplit, coreIds);

    let coreQuestionMetrics: StudyAnalysisCoreQuestionMetric[] | undefined;
    let branchSpecificMetrics: StudyAnalysisBranchMetric[] | undefined;

    if (isSplit || questionDiff.sharedQuestionIds.length > 0) {
      coreQuestionMetrics = metricComparison.closedQuestionComparison
        .filter((q) => coreIds.has(q.questionId))
        .map((q) => ({
          questionId: q.questionId,
          title: q.questionTitle,
          perVariant: q.perVariant,
        }));
    }

    if (isSplit || bundles.length > 1) {
      branchSpecificMetrics = bundles.map((bundle) => {
        const variantIds = new Set(bundle.form.questions.map((q) => q.id));
        const exclusiveQuestionIds = [...variantIds].filter((id) => !coreIds.has(id));
        return {
          variantKey: bundle.key,
          exclusiveQuestionIds,
          topTopics: bundle.form.analytics?.topics?.topTopics?.slice(0, 6) ?? [],
          summary: bundle.form.analytics?.insights?.summary,
        };
      });
    }

    return {
      totalResponses: bundles.reduce((sum, b) => sum + b.responseCount, 0),
      researchDesignType: project.researchDesignType,
      variants: variantMetrics,
      dominantTopics,
      coreQuestionMetrics: coreQuestionMetrics?.length ? coreQuestionMetrics : undefined,
      branchSpecificMetrics,
    };
  }

  private mergeDominantTopics(
    bundles: VariantAnalyticsBundle[],
    isSplit: boolean,
    coreIds: Set<string>,
  ): Array<{ topic: string; count: number }> {
    const counts = new Map<string, number>();

    for (const bundle of bundles) {
      const distribution = bundle.form.analytics?.topics?.distribution ?? {};
      for (const [topic, data] of Object.entries(distribution)) {
        const count = (data as { count: number }).count ?? 0;
        if (isSplit && bundles.length > 1) {
          const relatedQuestions = (data as { associatedQuestions?: string[] }).associatedQuestions ?? [];
          if (relatedQuestions.length > 0 && !relatedQuestions.some((id) => coreIds.has(id))) {
            continue;
          }
        }
        counts.set(topic, (counts.get(topic) ?? 0) + count);
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([topic, count]) => ({ topic, count }));
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
