import { Module, DynamicModule, Global } from '@nestjs/common';
import { PluginLoaderService } from './plugin-loader.service';
import { registerCoreSchemas } from '../schemas/core-schema-registry';

@Global()
@Module({
    providers: [PluginLoaderService],
    exports: [PluginLoaderService],
})
export class PluginsModule {
    static async forRoot(): Promise<DynamicModule> {
        registerCoreSchemas();
        const pluginLoader = new PluginLoaderService();
        const pluginModules = await pluginLoader.loadPlugins();

        return {
            module: PluginsModule,
            imports: pluginModules,
            providers: [
                {
                    provide: PluginLoaderService,
                    useValue: pluginLoader,
                },
            ],
            exports: [PluginLoaderService],
        };
    }
}
