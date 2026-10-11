import type { IntegrationConnectionDocument } from '../../schemas/integration-connection.schema';
import type { CommandResult, NormalizedCommand, NormalizedCommandType } from '../adapters/integration-adapter.interface';

export interface IntegrationCommandContext {
  userId: string;
  connection: IntegrationConnectionDocument;
}

export interface IntegrationCommandHandler {
  readonly commandType: NormalizedCommandType;
  execute(command: NormalizedCommand, ctx: IntegrationCommandContext): Promise<CommandResult>;
}
