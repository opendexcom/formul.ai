import { Module, DynamicModule, Global } from '@nestjs/common';
import { PluginLoaderService } from './plugin-loader.service';

@Global()
@Module({
    providers: [PluginLoaderService],
    exports: [PluginLoaderService],
})
export class PluginsModule {
    static async forRoot(): Promise<DynamicModule> {
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
