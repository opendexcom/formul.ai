import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  IntegrationConnection,
  IntegrationConnectionSchema,
} from '../schemas/integration-connection.schema';
import { ProjectsModule } from '../projects/projects.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { AdapterRegistryService } from './adapters/adapter-registry.service';
import { GenericWebhookAdapter } from './adapters/generic-webhook.adapter';
import { SlackInboundAdapter } from './adapters/slack-inbound.adapter';
import { DiscordInboundAdapter } from './adapters/discord-inbound.adapter';
import { TeamsInboundAdapter } from './adapters/teams-inbound.adapter';
import { InboundWebhookController } from './inbound/inbound-webhook.controller';
import { InboundRouterService } from './inbound/inbound-router.service';
import { CommandRegistryService } from './commands/command-registry.service';
import { CreateStudyHandler } from './commands/create-study.handler';
import { HelpHandler } from './commands/help.handler';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IntegrationConnection.name, schema: IntegrationConnectionSchema },
    ]),
    ProjectsModule,
  ],
  controllers: [IntegrationsController, InboundWebhookController],
  providers: [
    IntegrationsService,
    AdapterRegistryService,
    GenericWebhookAdapter,
    SlackInboundAdapter,
    DiscordInboundAdapter,
    TeamsInboundAdapter,
    InboundRouterService,
    CommandRegistryService,
    CreateStudyHandler,
    HelpHandler,
    {
      provide: 'INTEGRATION_COMMAND_BOOTSTRAP',
      useFactory: (
        commandRegistry: CommandRegistryService,
        createStudyHandler: CreateStudyHandler,
        helpHandler: HelpHandler,
      ) => {
        commandRegistry.register(createStudyHandler);
        commandRegistry.register(helpHandler);
        return true;
      },
      inject: [CommandRegistryService, CreateStudyHandler, HelpHandler],
    },
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
