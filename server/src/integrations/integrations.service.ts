import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';
import {
  IntegrationConnection,
  IntegrationConnectionDocument,
  IntegrationProvider,
} from '../schemas/integration-connection.schema';
import { AdapterRegistryService } from './adapters/adapter-registry.service';
import { GenericWebhookAdapter } from './adapters/generic-webhook.adapter';
import { SlackInboundAdapter } from './adapters/slack-inbound.adapter';
import { DiscordInboundAdapter } from './adapters/discord-inbound.adapter';
import { TeamsInboundAdapter } from './adapters/teams-inbound.adapter';
import type { IntegrationProviderId } from './adapters/integration-adapter.interface';
import {
  generateInboundSecret,
  hashInboundSecret,
} from './utils/integration-secret.util';

const INBOUND_PROVIDERS: IntegrationProviderId[] = [
  'slack',
  'teams',
  'discord',
  'generic_webhook',
];

@Injectable()
export class IntegrationsService implements OnModuleInit {
  constructor(
    @InjectModel(IntegrationConnection.name)
    private integrationModel: Model<IntegrationConnectionDocument>,
    private readonly adapterRegistry: AdapterRegistryService,
    private readonly genericWebhookAdapter: GenericWebhookAdapter,
    private readonly slackInboundAdapter: SlackInboundAdapter,
    private readonly discordInboundAdapter: DiscordInboundAdapter,
    private readonly teamsInboundAdapter: TeamsInboundAdapter,
  ) {}

  onModuleInit(): void {
    this.adapterRegistry.register(this.genericWebhookAdapter);
    this.adapterRegistry.register(this.slackInboundAdapter);
    this.adapterRegistry.register(this.discordInboundAdapter);
    this.adapterRegistry.register(this.teamsInboundAdapter);
  }

  async getStatus(userId: string) {
    const connections = await this.integrationModel
      .find({ userId: new Types.ObjectId(userId) })
      .lean();

    const byProvider = Object.fromEntries(
      connections.map((connection) => [connection.provider, connection]),
    );

    const buildProviderStatus = (provider: IntegrationProviderId) => {
      const connection = byProvider[provider];
      const hookId = connection?.config?.hookId;
      return {
        connected: connection?.connected === true,
        available: true,
        hookUrl: hookId ? this.buildHookUrl(hookId) : null,
        lastUsedAt: connection?.lastUsedAt ?? null,
        hasDiscordPublicKey: Boolean(connection?.config?.discordPublicKey),
      };
    };

    return {
      slack: buildProviderStatus('slack'),
      teams: buildProviderStatus('teams'),
      discord: buildProviderStatus('discord'),
      genericWebhook: buildProviderStatus('generic_webhook'),
      analysisApi: {
        connected: byProvider.analysis_api?.connected === true,
        available: false,
        hookUrl: null,
        lastUsedAt: byProvider.analysis_api?.lastUsedAt ?? null,
      },
    };
  }

  async connect(
    userId: string,
    providerParam: string,
    options?: { discordPublicKey?: string },
  ) {
    const provider = this.parseInboundProvider(providerParam);
    const hookId = randomUUID();
    const secret = generateInboundSecret();
    const secretHash = hashInboundSecret(secret);
    const hookUrl = this.buildHookUrl(hookId);

    const config: IntegrationConnection['config'] = {
      hookId,
      secretHash,
    };

    if (provider === 'discord' && options?.discordPublicKey?.trim()) {
      config.discordPublicKey = options.discordPublicKey.trim();
    }

    const connection = await this.integrationModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), provider },
      {
        userId: new Types.ObjectId(userId),
        provider,
        config,
        connected: false,
        lastUsedAt: undefined,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const adapter = this.adapterRegistry.get(provider);
    const setupInstructions = adapter.setupInstructions({
      hookId,
      hookUrl,
      discordPublicKey: config.discordPublicKey,
    });

    return {
      provider,
      hookId,
      hookUrl,
      secret,
      connected: connection.connected,
      setupInstructions,
    };
  }

  async disconnect(userId: string, providerParam: string) {
    const provider = this.parseInboundProvider(providerParam);
    const result = await this.integrationModel.deleteOne({
      userId: new Types.ObjectId(userId),
      provider,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException(`No ${provider} integration found`);
    }

    return { success: true, provider };
  }

  buildHookUrl(hookId: string): string {
    const apiBase =
      process.env.API_PUBLIC_URL ||
      process.env.FRONTEND_URL?.replace(/:\d+$/, ':3001') ||
      'http://localhost:3001';
    const normalizedBase = apiBase.replace(/\/$/, '').replace(/\/api$/, '');
    return `${normalizedBase}/api/integrations/hooks/${hookId}`;
  }

  private parseInboundProvider(providerParam: string): IntegrationProviderId {
    const normalized = providerParam.replace(/-/g, '_').toLowerCase();
    const aliases: Record<string, IntegrationProviderId> = {
      slack: 'slack',
      teams: 'teams',
      discord: 'discord',
      generic_webhook: 'generic_webhook',
      generic: 'generic_webhook',
      genericwebhook: 'generic_webhook',
    };

    const provider = aliases[normalized];
    if (!provider || !INBOUND_PROVIDERS.includes(provider)) {
      throw new BadRequestException(`Unsupported integration provider: ${providerParam}`);
    }
    return provider;
  }
}
