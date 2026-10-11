import { Injectable } from '@nestjs/common';
import { createPublicKey, verify } from 'crypto';
import type { Request } from 'express';
import type {
  IntegrationConnectionContext,
  IntegrationInboundAdapter,
  NormalizedCommand,
} from './integration-adapter.interface';
import {
  extractSecretFromRequest,
  verifyInboundSecret,
} from '../utils/integration-secret.util';
import { parseTextCommand } from '../utils/command-parser.util';
import type { IntegrationConnectionDocument } from '../../schemas/integration-connection.schema';

interface DiscordInteraction {
  type: number;
  data?: {
    name?: string;
    options?: Array<{ name: string; value?: string | number }>;
  };
  member?: { user?: { id?: string } };
  user?: { id?: string };
  channel_id?: string;
}

@Injectable()
export class DiscordInboundAdapter implements IntegrationInboundAdapter {
  readonly providerId = 'discord' as const;

  verify(req: Request, connection: IntegrationConnectionDocument, rawBody?: Buffer): boolean {
    const publicKey = connection.config?.discordPublicKey;
    if (publicKey && rawBody) {
      return this.verifyDiscordSignature(req, rawBody, publicKey);
    }

    const secret = extractSecretFromRequest(req);
    const storedHash = connection.config?.secretHash;
    if (!secret || !storedHash) {
      return false;
    }
    return verifyInboundSecret(secret, storedHash);
  }

  tryEarlyResponse(req: Request, rawBody?: Buffer): unknown | null {
    const interaction = this.readInteraction(req, rawBody);
    if (interaction?.type === 1) {
      return { type: 1 };
    }
    return null;
  }

  parse(req: Request, rawBody?: Buffer): NormalizedCommand | null {
    const interaction = this.readInteraction(req, rawBody);
    if (!interaction || interaction.type !== 2) {
      return null;
    }

    const externalUserId =
      interaction.member?.user?.id ?? interaction.user?.id ?? undefined;
    const externalChannelId = interaction.channel_id;

    const commandName = interaction.data?.name?.toLowerCase();
    const options = interaction.data?.options ?? [];

    if (commandName === 'formulai' || commandName === 'help') {
      const subcommand = options.find((option) => option.name === 'action')?.value;
      if (String(subcommand).toLowerCase() === 'help') {
        return {
          type: 'help',
          args: {},
          rawText: 'help',
          externalUserId,
          externalChannelId,
        };
      }
    }

    const nameOption = options.find(
      (option) => option.name === 'name' || option.name === 'study_name',
    );
    if (nameOption?.value) {
      return {
        type: 'create_study',
        args: { name: String(nameOption.value) },
        rawText: `create_study ${nameOption.value}`,
        externalUserId,
        externalChannelId,
      };
    }

    const textOption = options.find((option) => option.name === 'text');
    if (textOption?.value) {
      return parseTextCommand(String(textOption.value), externalUserId, externalChannelId);
    }

    return {
      type: 'unknown',
      args: {},
      rawText: commandName ?? '',
      externalUserId,
      externalChannelId,
    };
  }

  formatResponse(result) {
    return {
      type: 4,
      data: {
        content: result.message,
      },
    };
  }

  formatError(message: string) {
    return {
      type: 4,
      data: {
        content: message,
      },
    };
  }

  setupInstructions(ctx: IntegrationConnectionContext) {
    return {
      title: 'Connect Discord',
      steps: [
        {
          title: 'Create a Discord Application',
          description:
            'In the Discord Developer Portal, create an application and copy its public key.',
        },
        {
          title: 'Set the Interactions Endpoint URL',
          description: `Paste your FormulAI hook URL (${ctx.hookUrl}) as the Interactions Endpoint URL.`,
        },
        {
          title: 'Save your public key in FormulAI',
          description:
            'Paste the Application Public Key during connect so FormulAI can verify Discord signatures.',
        },
        {
          title: 'Register a slash command',
          description:
            'Create `/formulai` with options such as `name` (string) for study creation.',
        },
      ],
      exampleCommand: '/formulai name:Employee Feedback',
    };
  }

  private readInteraction(req: Request, rawBody?: Buffer): DiscordInteraction | null {
    if (rawBody) {
      try {
        return JSON.parse(rawBody.toString('utf8')) as DiscordInteraction;
      } catch {
        return null;
      }
    }

    if (req.body && typeof req.body === 'object') {
      return req.body as DiscordInteraction;
    }

    return null;
  }

  private verifyDiscordSignature(
    req: Request,
    rawBody: Buffer,
    publicKeyHex: string,
  ): boolean {
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    if (typeof signature !== 'string' || typeof timestamp !== 'string') {
      return false;
    }

    try {
      const publicKey = createPublicKey({
        key: Buffer.concat([
          Buffer.from('302a300506032b6570032100', 'hex'),
          Buffer.from(publicKeyHex, 'hex'),
        ]),
        format: 'der',
        type: 'spki',
      });

      return verify(
        null,
        Buffer.from(timestamp + rawBody.toString('utf8')),
        publicKey,
        Buffer.from(signature, 'hex'),
      );
    } catch {
      return false;
    }
  }
}
