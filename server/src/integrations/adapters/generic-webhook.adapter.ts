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
import { parseJsonCommand } from '../utils/command-parser.util';
import type { IntegrationConnectionDocument } from '../../schemas/integration-connection.schema';

@Injectable()
export class GenericWebhookAdapter implements IntegrationInboundAdapter {
  readonly providerId = 'generic_webhook' as const;

  verify(req: Request, connection: IntegrationConnectionDocument): boolean {
    const secret = extractSecretFromRequest(req);
    const storedHash = connection.config?.secretHash;
    if (!secret || !storedHash) {
      return false;
    }
    return verifyInboundSecret(secret, storedHash);
  }

  parse(req: Request) {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return parseJsonCommand({});
    }
    return parseJsonCommand(body as Record<string, unknown>);
  }

  formatResponse(result, command) {
    return {
      success: result.success,
      command: command.type,
      message: result.message,
      data: result.data ?? null,
    };
  }

  formatError(message: string) {
    return { success: false, message };
  }

  setupInstructions(ctx: IntegrationConnectionContext) {
    return {
      title: 'Connect a generic webhook',
      steps: [
        {
          title: 'Copy your hook URL and secret',
          description:
            'Use the hook URL as the POST destination and send the secret in the Authorization header or X-FormulAI-Secret.',
        },
        {
          title: 'Send a JSON command',
          description:
            'POST JSON such as {"command":"create_study","name":"Employee Feedback"} to create a study.',
        },
      ],
      exampleCommand: `curl -X POST "${ctx.hookUrl}" -H "Authorization: Bearer <secret>" -H "Content-Type: application/json" -d '{"command":"create_study","name":"Employee Feedback"}'`,
    };
  }
}
