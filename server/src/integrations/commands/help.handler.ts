import { Injectable } from '@nestjs/common';
import type { IntegrationCommandHandler } from './integration-command.interface';
import type { NormalizedCommand } from '../adapters/integration-adapter.interface';

@Injectable()
export class HelpHandler implements IntegrationCommandHandler {
  readonly commandType = 'help' as const;

  async execute(_command: NormalizedCommand) {
    return {
      success: true,
      message: [
        'FormulAI integration commands:',
        '- create_study "Study name" — create a new study/project',
        '- help — show this message',
        '',
        'Examples:',
        '- /formulai new-study "Employee Feedback"',
        '- {"command":"create_study","name":"Employee Feedback"}',
        '- /formulai name:Employee Feedback (Discord)',
      ].join('\n'),
    };
  }
}
