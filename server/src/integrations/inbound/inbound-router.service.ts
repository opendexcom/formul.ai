import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Request } from 'express';
import { Model } from 'mongoose';
import {
  IntegrationConnection,
  IntegrationConnectionDocument,
  IntegrationProvider,
} from '../../schemas/integration-connection.schema';
import { AdapterRegistryService } from '../adapters/adapter-registry.service';
import { CommandRegistryService } from '../commands/command-registry.service';
import type { IntegrationProviderId } from '../adapters/integration-adapter.interface';

@Injectable()
export class InboundRouterService {
  private readonly logger = new Logger(InboundRouterService.name);

  constructor(
    @InjectModel(IntegrationConnection.name)
    private integrationModel: Model<IntegrationConnectionDocument>,
    private readonly adapterRegistry: AdapterRegistryService,
    private readonly commandRegistry: CommandRegistryService,
  ) {}

  async handleInbound(
    hookId: string,
    req: Request,
    rawBody?: Buffer,
  ): Promise<{ statusCode: number; body: unknown }> {
    const connection = await this.integrationModel.findOne({ 'config.hookId': hookId });
    if (!connection) {
      throw new NotFoundException('Integration hook not found');
    }

    const providerId = connection.provider as IntegrationProviderId;
    if (!this.isInboundProvider(providerId)) {
      throw new BadRequestException(`Provider ${connection.provider} does not support inbound hooks`);
    }

    const adapter = this.adapterRegistry.get(providerId);

    if (!adapter.verify(req, connection, rawBody)) {
      throw new UnauthorizedException('Invalid integration credentials');
    }

    const earlyResponse = adapter.tryEarlyResponse?.(req, rawBody);
    if (earlyResponse) {
      await this.markUsed(connection);
      return { statusCode: 200, body: earlyResponse };
    }

    const command = adapter.parse(req, rawBody);
    if (!command) {
      return {
        statusCode: 200,
        body: adapter.formatError('Could not parse command'),
      };
    }

    if (command.type === 'unknown') {
      return {
        statusCode: 200,
        body: adapter.formatError(
          'Unknown command. Send help to see available commands.',
          command,
        ),
      };
    }

    const handler = this.commandRegistry.get(command.type);
    if (!handler) {
      return {
        statusCode: 200,
        body: adapter.formatError(`No handler registered for command: ${command.type}`, command),
      };
    }

    try {
      const result = await handler.execute(command, {
        userId: connection.userId.toString(),
        connection,
      });
      await this.markUsed(connection, true);
      return {
        statusCode: 200,
        body: adapter.formatResponse(result, command),
      };
    } catch (error) {
      const message =
        error instanceof BadRequestException
          ? String(error.message)
          : 'Command failed. Please try again.';
      this.logger.warn(`Inbound command failed for hook ${hookId}: ${message}`);
      return {
        statusCode: 200,
        body: adapter.formatError(message, command),
      };
    }
  }

  private async markUsed(
    connection: IntegrationConnectionDocument,
    markConnected = false,
  ): Promise<void> {
    connection.lastUsedAt = new Date();
    if (markConnected) {
      connection.connected = true;
    }
    await connection.save();
  }

  private isInboundProvider(provider: IntegrationProvider): provider is IntegrationProviderId {
    return ['slack', 'teams', 'discord', 'generic_webhook'].includes(provider);
  }
}
