import { Injectable } from '@nestjs/common';
import type { IntegrationCommandHandler } from './integration-command.interface';
import type { NormalizedCommandType } from '../adapters/integration-adapter.interface';

@Injectable()
export class CommandRegistryService {
  private readonly handlers = new Map<NormalizedCommandType, IntegrationCommandHandler>();

  register(handler: IntegrationCommandHandler): void {
    this.handlers.set(handler.commandType, handler);
  }

  get(commandType: NormalizedCommandType): IntegrationCommandHandler | undefined {
    return this.handlers.get(commandType);
  }
}
