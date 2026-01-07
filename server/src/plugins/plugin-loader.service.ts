import { Injectable, Logger, DynamicModule } from '@nestjs/common';
import { FormulAIPlugin, PluginConfig } from '@opendexcom/plugin-interface';

@Injectable()
export class PluginLoaderService {
    private readonly logger = new Logger(PluginLoaderService.name);
    private loadedPlugins: Map<string, FormulAIPlugin> = new Map();

    /**
     * Load plugins from environment configuration
     */
    async loadPlugins(): Promise<DynamicModule[]> {
        const pluginConfigs = this.getPluginConfigs();
        const modules: DynamicModule[] = [];

        for (const [pluginName, config] of Object.entries(pluginConfigs)) {
            if (!config.enabled) {
                this.logger.log(`Plugin ${pluginName} is disabled, skipping`);
                continue;
            }

            try {
                const plugin = await this.loadPlugin(pluginName, config);
                const module = await plugin.register();
                modules.push(module);
                this.loadedPlugins.set(pluginName, plugin);
                this.logger.log(`✓ Loaded plugin: ${plugin.name} v${plugin.version}`);
            } catch (error) {
                this.logger.error(`✗ Failed to load plugin ${pluginName}:`, error.message);
                // Continue loading other plugins
            }
        }

        return modules;
    }

    /**
     * Load a single plugin by name
     */
    private async loadPlugin(
        pluginName: string,
        config: PluginConfig,
    ): Promise<FormulAIPlugin> {
        // Try loading from npm package
        try {
            const pluginModule = await import(pluginName);
            return new pluginModule.default(config.options);
        } catch (npmError) {
            // Try loading from custom plugin directory or default local directory
            try {
                const pluginDir = process.env.PLUGIN_DIR || '../../plugins';
                const localPath = `${pluginDir}/${pluginName}`;
                const pluginModule = await import(localPath);
                return new pluginModule.default(config.options);
            } catch (localError) {
                throw new Error(
                    `Plugin ${pluginName} not found in npm or at ${process.env.PLUGIN_DIR || '../../plugins'}/${pluginName}`,
                );
            }
        }
    }

    /**
     * Parse plugin configuration from environment
     */
    private getPluginConfigs(): Record<string, PluginConfig> {
        const configs: Record<string, PluginConfig> = {};

        // Example: PLUGINS=billing:enabled=true,usage-tracking:enabled=true
        const pluginsEnv = process.env.PLUGINS || '';

        if (!pluginsEnv) {
            return configs;
        }

        const pluginEntries = pluginsEnv.split(',');

        for (const entry of pluginEntries) {
            const [name, ...options] = entry.split(':');
            configs[name] = {
                enabled: true,
                options: this.parseOptions(options),
            };
        }

        return configs;
    }

    private parseOptions(options: string[]): Record<string, any> {
        const parsed: Record<string, any> = {};
        for (const option of options) {
            const [key, value] = option.split('=');
            parsed[key] = value === 'true' ? true : value === 'false' ? false : value;
        }
        return parsed;
    }

    /**
     * Get loaded plugin instance
     */
    getPlugin(name: string): FormulAIPlugin | undefined {
        return this.loadedPlugins.get(name);
    }

    /**
     * Initialize all plugins after app bootstrap
     */
    async initializePlugins(app: any): Promise<void> {
        for (const [name, plugin] of this.loadedPlugins) {
            if (plugin.onApplicationBootstrap) {
                try {
                    await plugin.onApplicationBootstrap(app);
                    this.logger.log(`✓ Initialized plugin: ${name}`);
                } catch (error) {
                    this.logger.error(`✗ Failed to initialize plugin ${name}:`, error.message);
                }
            }
        }
    }

    /**
     * Shutdown all plugins
     */
    async shutdownPlugins(): Promise<void> {
        for (const [name, plugin] of this.loadedPlugins) {
            if (plugin.onApplicationShutdown) {
                try {
                    await plugin.onApplicationShutdown();
                    this.logger.log(`✓ Shutdown plugin: ${name}`);
                } catch (error) {
                    this.logger.error(`✗ Failed to shutdown plugin ${name}:`, error.message);
                }
            }
        }
    }
}
