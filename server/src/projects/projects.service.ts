import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Form, FormDocument } from '../schemas/form.schema';
import { Project, ProjectDocument, ProjectStatus } from '../schemas/project.schema';
import { Response, ResponseDocument } from '../schemas/response.schema';
import { CreateProjectDto, AddProjectVariantDto, UpdateProjectDto, UpdateProjectVariantDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
    @InjectModel(Response.name) private responseModel: Model<ResponseDocument>,
  ) {}

  async create(createProjectDto: CreateProjectDto, userId: string): Promise<ProjectDocument> {
    const ownerId = new Types.ObjectId(userId);
    const initialHypotheses = createProjectDto.hypothesis?.trim()
      ? [createProjectDto.hypothesis.trim()]
      : [];
    const project = await this.projectModel.create({
      name: createProjectDto.name,
      hypothesis: createProjectDto.hypothesis,
      hypotheses: initialHypotheses,
      ownerId,
      type: createProjectDto.type ?? 'single',
      status: 'designing',
      variants: [],
    });

    const form = await this.formModel.create({
      title: createProjectDto.name,
      description: createProjectDto.hypothesis ?? '',
      createdBy: ownerId,
      projectId: project._id,
      variantKey: 'main',
      questions: [],
      isActive: false,
      isPublic: false,
      settings: {
        allowMultipleResponses: true,
        requireLogin: false,
        showProgressBar: true,
      },
    });

    project.variants = [
      {
        key: 'main',
        formId: form._id as Types.ObjectId,
        targetGroup: { name: 'General' },
      },
    ];
    await project.save();
    return project;
  }

  async getDashboardSummary(userId: string) {
    const ownerId = new Types.ObjectId(userId);
    const projects = await this.projectModel.find({ ownerId }).sort({ updatedAt: -1 }).lean();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const activeStatuses = new Set([
      'designing',
      'published',
      'collecting',
      'analyzing',
      'analyzed',
      'reported',
    ]);
    const analyzedStatuses = new Set(['analyzed', 'reported', 'completed']);
    const runningAbStatuses = new Set(['published', 'collecting', 'analyzing']);

    let totalResponses = 0;
    let responsesLast7Days = 0;
    let responsesPrev7Days = 0;
    let aiAnalysesReady = 0;
    let abTestsRunning = 0;
    let activeStudies = 0;

    const studies = await Promise.all(
      projects.map(async (project) => {
        const formIds = project.variants.map((variant) => variant.formId);
        const responseCount = formIds.length
          ? await this.responseModel.countDocuments({ formId: { $in: formIds } })
          : 0;
        const responsesThisWeek = formIds.length
          ? await this.responseModel.countDocuments({
              formId: { $in: formIds },
              submittedAt: { $gte: sevenDaysAgo },
            })
          : 0;

        totalResponses += responseCount;

        if (activeStatuses.has(project.status)) {
          activeStudies += 1;
        }
        if (analyzedStatuses.has(project.status)) {
          aiAnalysesReady += 1;
        }
        if (project.type === 'ab_test' && runningAbStatuses.has(project.status)) {
          abTestsRunning += 1;
        }

        const aiStatus = this.deriveAiStatus(project.status, responseCount);

        return {
          _id: project._id,
          name: project.name,
          hypothesis: project.hypothesis,
          type: project.type,
          status: project.status,
          responseCount,
          responsesThisWeek,
          aiStatus,
          updatedAt: (project as { updatedAt?: Date }).updatedAt,
          createdAt: (project as { createdAt?: Date }).createdAt,
        };
      }),
    );

    if (projects.length > 0) {
      const allFormIds = projects.flatMap((project) =>
        project.variants.map((variant) => variant.formId),
      );
      if (allFormIds.length > 0) {
        responsesPrev7Days = await this.responseModel.countDocuments({
          formId: { $in: allFormIds },
          submittedAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo },
        });
        responsesLast7Days = await this.responseModel.countDocuments({
          formId: { $in: allFormIds },
          submittedAt: { $gte: sevenDaysAgo },
        });
      }
    }

    return {
      totalStudies: projects.length,
      activeStudies,
      totalResponses,
      responsesLast7Days,
      responsesPrev7Days,
      aiAnalysesReady,
      abTestsRunning,
      studies,
    };
  }

  private deriveAiStatus(
    status: ProjectStatus,
    responseCount: number,
  ): 'ready' | 'needs_data' | 'reported' | 'analyzing' | 'not_started' {
    if (status === 'analyzing') return 'analyzing';
    if (status === 'reported') return 'reported';
    if (status === 'analyzed' || status === 'completed') return 'ready';
    if (responseCount > 0 && ['collecting', 'published'].includes(status)) {
      return responseCount < 10 ? 'needs_data' : 'not_started';
    }
    return 'not_started';
  }

  async findAllByUser(
    userId: string,
  ): Promise<Array<Project & { _id: Types.ObjectId; responseCount: number }>> {
    const ownerId = new Types.ObjectId(userId);
    const projects = await this.projectModel.find({ ownerId }).sort({ createdAt: -1 }).lean();

    const counts = await Promise.all(
      projects.map(async (project) => {
        const formIds = project.variants.map((variant) => variant.formId);
        const responseCount = formIds.length
          ? await this.responseModel.countDocuments({ formId: { $in: formIds } })
          : 0;
        return { ...project, responseCount };
      }),
    );
    return counts as Array<Project & { _id: Types.ObjectId; responseCount: number }>;
  }

  async findOne(projectId: string, userId: string): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(projectId).exec();
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.ownerId.toString() !== userId.toString()) {
      throw new ForbiddenException('Access denied');
    }
    return project;
  }

  async update(
    projectId: string,
    dto: UpdateProjectDto,
    userId: string,
  ): Promise<ProjectDocument> {
    const project = await this.findOne(projectId, userId);
    if (dto.name) {
      project.name = dto.name;
    }
    if (dto.hypothesis !== undefined) {
      project.hypothesis = dto.hypothesis;
    }
    if (dto.hypotheses !== undefined) {
      project.hypotheses = dto.hypotheses.map((item) => item.trim()).filter(Boolean);
      project.hypothesis = project.hypotheses[0];
    }
    if (dto.researchNotes !== undefined) {
      project.researchNotes = dto.researchNotes.trim() || undefined;
    }
    return project.save();
  }

  async updateVariant(
    projectId: string,
    variantKey: string,
    dto: UpdateProjectVariantDto,
    userId: string,
  ): Promise<ProjectDocument> {
    const project = await this.findOne(projectId, userId);
    const variant = project.variants.find((item) => item.key === variantKey);
    if (!variant) {
      throw new NotFoundException(`Variant ${variantKey} not found`);
    }

    if (dto.internalDescription !== undefined) {
      variant.internalDescription = dto.internalDescription.trim() || undefined;
    }
    if (dto.targetGroupName !== undefined) {
      variant.targetGroup = {
        name: dto.targetGroupName.trim() || 'General',
        description: variant.targetGroup?.description,
      };
    }

    return project.save();
  }

  async archive(projectId: string, userId: string): Promise<ProjectDocument> {
    const project = await this.findOne(projectId, userId);
    project.status = 'archived';
    return project.save();
  }

  async addVariant(
    projectId: string,
    dto: AddProjectVariantDto,
    userId: string,
  ): Promise<ProjectDocument> {
    const project = await this.findOne(projectId, userId);
    const ownerId = new Types.ObjectId(userId);
    const existingKeys = new Set(project.variants.map((variant) => variant.key));

    let key = dto.key;
    if (!key) {
      if (!existingKeys.has('A')) key = 'A';
      else if (!existingKeys.has('B')) key = 'B';
      else throw new BadRequestException('Maximum number of variants reached');
    }

    if (existingKeys.has(key)) {
      throw new BadRequestException(`Variant ${key} already exists`);
    }

    const cloneFromKey = dto.cloneFromKey ?? 'main';
    const sourceVariant = project.variants.find((variant) => variant.key === cloneFromKey);
    if (!sourceVariant) {
      throw new BadRequestException(`Source variant ${cloneFromKey} not found`);
    }

    const sourceForm = await this.formModel.findById(sourceVariant.formId).lean();
    if (!sourceForm) {
      throw new NotFoundException('Source form not found');
    }

    const sourceQuestionIds = (sourceForm.questions ?? []).map((q) => q.id);
    const excludeSet = new Set(dto.excludeQuestionIds ?? []);
    const modifiedSet = new Set(dto.modifiedQuestionIds ?? []);
    const polaritySet = new Set(dto.polarityFlippedQuestionIds ?? []);
    const hasSplitDesign =
      excludeSet.size > 0 || modifiedSet.size > 0 || polaritySet.size > 0;

    let clonedQuestions = JSON.parse(JSON.stringify(sourceForm.questions ?? [])) as Array<
      Record<string, unknown> & { id: string; reverseCoded?: boolean; pairedQuestionId?: string }
    >;

    if (excludeSet.size > 0) {
      clonedQuestions = clonedQuestions.filter((q) => !excludeSet.has(q.id));
    }

    for (const question of clonedQuestions) {
      if (polaritySet.has(question.id)) {
        question.reverseCoded = true;
        question.pairedQuestionId = question.id;
      }
    }

    const coreQuestionIds = sourceQuestionIds.filter(
      (id) => !excludeSet.has(id) && !modifiedSet.has(id),
    );

    const newForm = await this.formModel.create({
      title: `${sourceForm.title} (${key})`,
      description: sourceForm.description ?? '',
      createdBy: ownerId,
      projectId: project._id,
      variantKey: key,
      questions: clonedQuestions,
      isActive: false,
      isPublic: false,
      settings: sourceForm.settings ?? {
        allowMultipleResponses: true,
        requireLogin: false,
        showProgressBar: true,
      },
    });

    project.variants.push({
      key,
      formId: newForm._id as Types.ObjectId,
      targetGroup: {
        name: dto.targetGroupName?.trim() || `Variant ${key}`,
      },
    });

    if (project.type === 'single') {
      project.type = 'ab_test';
    }

    if (hasSplitDesign) {
      project.researchDesignType = 'split_questionnaire';
      const existingDesign = project.splitQuestionnaireDesign ?? {
        coreQuestionIds: [],
        perVariant: {},
      };
      const mergedCoreIds = new Set([
        ...existingDesign.coreQuestionIds,
        ...coreQuestionIds,
      ]);
      for (const id of modifiedSet) mergedCoreIds.delete(id);
      for (const id of excludeSet) mergedCoreIds.delete(id);

      existingDesign.coreQuestionIds = [...mergedCoreIds];
      existingDesign.perVariant = existingDesign.perVariant ?? {};
      existingDesign.perVariant[key] = {
        modifiedQuestionIds: [...modifiedSet],
        excludedQuestionIds: [...excludeSet],
        polarityFlippedQuestionIds: [...polaritySet],
        polarityPairs: Object.fromEntries([...polaritySet].map((questionId) => [questionId, questionId])),
      };
      project.splitQuestionnaireDesign = existingDesign;
    }

    return project.save();
  }

  async getProjectResponses(
    projectId: string,
    userId: string,
    options?: { page?: number; limit?: number; variant?: 'main' | 'A' | 'B' },
  ): Promise<Record<string, unknown>> {
    const project = await this.findOne(projectId, userId);
    let variants = project.variants;
    if (options?.variant) {
      variants = variants.filter((variant) => variant.key === options.variant);
    }
    const formIdToVariant = new Map(
      variants.map((variant) => [variant.formId.toString(), variant.key]),
    );
    const formIds = variants.map((variant) => variant.formId);
    if (formIds.length === 0) {
      return { items: [], total: 0, page: 1, limit: options?.limit ?? 25, totalPages: 0 };
    }

    const filter = { formId: { $in: formIds } };
    const total = await this.responseModel.countDocuments(filter);
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(100, Math.max(1, options?.limit ?? 25));
    const skip = (page - 1) * limit;

    const items = await this.responseModel
      .find(filter)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      items: items.map((item) => ({
        ...item,
        variantKey: formIdToVariant.get(String(item.formId)) ?? 'main',
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async generateProjectReport(projectId: string, userId: string): Promise<Record<string, unknown>> {
    const project = await this.findOne(projectId, userId);
    return {
      projectId: project._id,
      message:
        'Use POST /projects/:id/comparative-report or GET /projects/:id/comparative-report/stream to generate the full cross-variant report.',
      comparativeReport: project.comparativeReport ?? null,
    };
  }

  async sendProjectReport(projectId: string, userId: string): Promise<Record<string, unknown>> {
    const project = await this.findOne(projectId, userId);
    return {
      projectId: project._id,
      message:
        'Report email delivery is enabled in the project pipeline API. Integrate SMTP/template provider in deployment runtime.',
    };
  }

  deriveProjectStatus(form: Pick<Form, 'isActive' | 'analytics'>, responseCount: number): ProjectStatus {
    if (!form.isActive && responseCount === 0) return 'designing';
    if (!form.isActive && responseCount > 0) return 'collecting';
    if (form.isActive && responseCount === 0) return 'published';
    if (form.analytics?.lastUpdated) return 'analyzed';
    return 'collecting';
  }
}
