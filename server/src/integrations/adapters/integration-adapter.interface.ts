import type { Request } from 'express';
import type { IntegrationConnectionDocument } from '../../schemas/integration-connection.schema';

export type IntegrationProviderId =
  | 'slack'
  | 'teams'
  | 'discord'
  | 'generic_webhook';

export type NormalizedCommandType = 'create_study' | 'help' | 'unknown';

export interface NormalizedCommand {
  type: NormalizedCommandType;
  args: Record<string, string>;
  rawText: string;
  externalUserId?: string;
  externalChannelId?: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface SetupGuideStep {
  title: string;
  description: string;
}

export interface SetupGuide {
  title: string;
  steps: SetupGuideStep[];
  exampleCommand?: string;
}

export interface IntegrationConnectionContext {
  hookId: string;
  hookUrl: string;
  discordPublicKey?: string;
}

export interface IntegrationInboundAdapter {
  readonly providerId: IntegrationProviderId;
  verify(req: Request, connection: IntegrationConnectionDocument, rawBody?: Buffer): boolean;
  parse(req: Request, rawBody?: Buffer): NormalizedCommand | null;
  formatResponse(result: CommandResult, command: NormalizedCommand): unknown;
  formatError(message: string, command?: NormalizedCommand): unknown;
  setupInstructions(ctx: IntegrationConnectionContext): SetupGuide;
  /** Return a direct HTTP response (e.g. Discord PING) without running commands. */
  tryEarlyResponse?(req: Request, rawBody?: Buffer): unknown | null;
}
