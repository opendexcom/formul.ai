import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Form } from '../schemas/form.schema';
import { Project, ProjectDocument } from '../schemas/project.schema';
import { ResearchContext } from './research-context.types';

@Injectable()
export class ResearchContextService {
  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
  ) {}

  normalizeHypotheses(project: Pick<Project, 'hypothesis' | 'hypotheses'>): string[] {
    const fromArray = (project.hypotheses ?? []).map((item) => item.trim()).filter(Boolean);
    if (fromArray.length > 0) {
      return fromArray;
    }
    if (project.hypothesis?.trim()) {
      return [project.hypothesis.trim()];
    }
    return [];
  }

  async resolveForForm(
    form: Pick<Form, 'projectId' | 'variantKey'> & { _id?: Types.ObjectId | string },
  ): Promise<ResearchContext | null> {
    if (!form.projectId) {
      return null;
    }

    const project = await this.projectModel.findById(form.projectId).lean();
    if (!project) {
      return null;
    }

    const formId = form._id?.toString();
    const variant =
      project.variants.find((item) => item.formId.toString() === formId) ??
      project.variants.find((item) => item.key === form.variantKey) ??
      project.variants[0];

    return {
      projectName: project.name,
      hypotheses: this.normalizeHypotheses(project),
      projectResearchNotes: project.researchNotes?.trim() || undefined,
      variantKey: variant?.key ?? form.variantKey ?? 'main',
      variantInternalDescription: variant?.internalDescription?.trim() || undefined,
      targetGroupName: variant?.targetGroup?.name,
    };
  }
}
