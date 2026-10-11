import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
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
export class SlackInboundAdapter implements IntegrationInboundAdapter {
  readonly providerId = 'slack' as const;

  verify(req: Request, connection: IntegrationConnectionDocument, rawBody?: Buffer): boolean {
    const signingSecret = connection.config?.signingSecret;
    if (signingSecret && rawBody) {
      return this.verifySlackSignature(req, rawBody, signingSecret);
    }

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

    if (typeof body.command === 'string') {
      const text = [body.command, body.text].filter(Boolean).join(' ').trim();
      return parseTextCommand(
        text,
        typeof body.user_id === 'string' ? body.user_id : undefined,
        typeof body.channel_id === 'string' ? body.channel_id : undefined,
      );
    }

    const text = typeof body.text === 'string' ? body.text : '';
    return parseTextCommand(
      text,
      typeof body.user_id === 'string' ? body.user_id : undefined,
      typeof body.channel_id === 'string' ? body.channel_id : undefined,
    );
  }

  formatResponse(result, command) {
    if (command.type === 'unknown') {
      return { text: result.message };
    }
    return { text: result.message, response_type: 'in_channel' };
  }

  formatError(message: string) {
    return { text: message, response_type: 'ephemeral' };
  }

  setupInstructions(ctx: IntegrationConnectionContext) {
    return {
      title: 'Connect Slack',
      steps: [
        {
          title: 'Create an outgoing webhook or slash command',
          description:
            'In Slack, create an outgoing webhook or slash command that POSTs to your FormulAI hook URL.',
        },
        {
          title: 'Add the shared secret',
          description:
            'Send the secret as Authorization: Bearer <secret> if your Slack setup supports custom headers. Otherwise append ?token=<secret> to the URL.',
        },
        {
          title: 'Try a command',
          description:
            'Send `/formulai new-study "Employee Feedback"` or a message containing that pattern.',
        },
      ],
      exampleCommand: `/formulai new-study "Employee Feedback"`,
    };
  }

  private verifySlackSignature(
    req: Request,
    rawBody: Buffer,
    signingSecret: string,
  ): boolean {
    const timestamp = req.headers['x-slack-request-timestamp'];
    const signature = req.headers['x-slack-signature'];
    if (typeof timestamp !== 'string' || typeof signature !== 'string') {
      return false;
    }

    const base = `v0:${timestamp}:${rawBody.toString('utf8')}`;
    const digest = `v0=${createHmac('sha256', signingSecret).update(base).digest('hex')}`;

    try {
      return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}
