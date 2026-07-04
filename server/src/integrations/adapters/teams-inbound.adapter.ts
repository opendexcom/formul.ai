import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type {
  IntegrationConnectionContext,
  IntegrationInboundAdapter,
} from './integration-adapter.interface';
import {
  extractSecretFromRequest,
  verifyInboundSecret,
} from '../utils/integration-secret.util';
import { parseTextCommand } from '../utils/command-parser.util';
import type { IntegrationConnectionDocument } from '../../schemas/integration-connection.schema';

@Injectable()
export class TeamsInboundAdapter implements IntegrationInboundAdapter {
  readonly providerId = 'teams' as const;

  verify(req: Request, connection: IntegrationConnectionDocument): boolean {
    const secret = extractSecretFromRequest(req);
    const storedHash = connection.config?.secretHash;
    if (!secret || !storedHash) {
      return false;
    }
    return verifyInboundSecret(secret, storedHash);
  }

  parse(req: Request) {
    const body = req.body as Record<string, unknown> | undefined;
    if (!body) {
      return parseTextCommand('');
    }

    const text =
      (typeof body.text === 'string' && body.text) ||
      (typeof body.message === 'string' && body.message) ||
      (typeof body.value === 'string' && body.value) ||
      '';

    const from =
      (body.from as { id?: string } | undefined)?.id ??
      (typeof body.userId === 'string' ? body.userId : undefined);
    const channelId =
      (body.channelData as { channel?: { id?: string } } | undefined)?.channel?.id ??
      (typeof body.channelId === 'string' ? body.channelId : undefined);

    return parseTextCommand(text, from, channelId);
  }

  formatResponse(result) {
    return {
      type: 'message',
      text: result.message,
    };
  }

  formatError(message: string) {
    return { type: 'message', text: message };
  }

  setupInstructions(ctx: IntegrationConnectionContext) {
    return {
      title: 'Connect Microsoft Teams',
      steps: [
        {
          title: 'Create an outgoing webhook or connector',
          description:
            'In Teams, configure an outgoing webhook or Power Automate flow that POSTs to your FormulAI hook URL.',
        },
        {
          title: 'Add the shared secret',
          description:
            'Include the secret in Authorization: Bearer <secret> or X-FormulAI-Secret when possible.',
        },
        {
          title: 'Try a command',
          description:
            'Send `@FormulAI new-study "Employee Feedback"` or a message containing that pattern.',
        },
      ],
      exampleCommand: `new-study "Employee Feedback"`,
    };
  }
}
