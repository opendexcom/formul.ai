import { BadRequestException, Injectable } from '@nestjs/common';
import { ProjectsService } from '../../projects/projects.service';
import type { IntegrationCommandHandler } from './integration-command.interface';
import type { NormalizedCommand } from '../adapters/integration-adapter.interface';

@Injectable()
export class CreateStudyHandler implements IntegrationCommandHandler {
  readonly commandType = 'create_study' as const;

  constructor(private readonly projectsService: ProjectsService) {}

  async execute(command: NormalizedCommand, ctx) {
    const name = command.args.name?.trim();
    if (!name) {
      throw new BadRequestException(
        'Study name is required. Example: create_study "Employee Feedback"',
      );
    }

    const project = await this.projectsService.create({ name }, ctx.userId);
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const projectUrl = `${frontendUrl}/projects/${project._id.toString()}`;

    return {
      success: true,
      message: `Created study "${name}": ${projectUrl}`,
      data: {
        projectId: project._id.toString(),
        projectUrl,
        name: project.name,
      },
    };
  }
}
