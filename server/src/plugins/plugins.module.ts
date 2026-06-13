import { Module, DynamicModule, Global } from '@nestjs/common';
import {
    DefaultPluginContributionRegistry,
    extendSchema,
    registerCapability,
    registerSchema,
    getSchema,
    getSchemaOrThrow,
    hasSchema,
    markSchemaCompiled,
} from '@opendexcom/plugin-interface';
import { PluginLoaderService } from './plugin-loader.service';
import { PLUGIN_CONTRIBUTION_REGISTRY } from './plugin-contribution.registry';
import { registerCoreSchemas } from '../schemas/core-schema-registry';
import { AiCoreModule } from '../ai/ai.module';

@Global()
@Module({
    providers: [PluginLoaderService],
    exports: [PluginLoaderService, PLUGIN_CONTRIBUTION_REGISTRY],
})
export class PluginsModule {
    static async forRoot(): Promise<DynamicModule> {
        registerCoreSchemas();
        const contributionRegistry = new DefaultPluginContributionRegistry();
        const pluginContext = {
            schemaRegistry: {
                register: registerSchema,
                extend: extendSchema,
                get: getSchema,
                getOrThrow: getSchemaOrThrow,
                has: hasSchema,
            },
            capabilities: {
                register: registerCapability,
            },
            hostModules: { aiCore: AiCoreModule },
        };
        const pluginLoader = new PluginLoaderService(contributionRegistry, pluginContext);
        const pluginModules = await pluginLoader.loadPlugins();

        return {
            module: PluginsModule,
            imports: pluginModules,
            providers: [
                {
                    provide: PLUGIN_CONTRIBUTION_REGISTRY,
                    useValue: contributionRegistry,
                },
                {
                    provide: PluginLoaderService,
                    useValue: pluginLoader,
                },
            ],
            exports: [PluginLoaderService, PLUGIN_CONTRIBUTION_REGISTRY],
        };
    }
}
