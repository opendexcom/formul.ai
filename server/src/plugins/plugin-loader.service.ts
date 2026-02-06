import { Injectable, Logger, DynamicModule } from '@nestjs/common';
import {
  FormulAIPlugin,
  PluginConfig,
  PluginContext,
  registerSchema,
  getSchema,
  getSchemaOrThrow,
  hasSchema,
} from '@opendexcom/plugin-interface';

@Injectable()
export class PluginLoaderService {
  private readonly logger = new Logger(PluginLoaderService.name);
  private loadedPlugins: Map<string, FormulAIPlugin> = new Map();

  /**
   * Build a PluginContext that references the host's schema registry.
   * Every plugin receives this so all schema operations go through
   * the same Map, regardless of how many copies of plugin-interface exist.
   */
  private buildPluginContext(): PluginContext {
    return {
      schemaRegistry: {
        register: registerSchema,
        get: getSchema,
        getOrThrow: getSchemaOrThrow,
        has: hasSchema,
      },
    };
  }

  /**
   * Load plugins from environment configuration.
   * Plugins that consume schemas from the registry (e.g. admin) are loaded last
   * so that schema-providing plugins (e.g. billing, usage-tracking) register first.
   */
  async loadPlugins(): Promise<DynamicModule[]> {
    const pluginConfigs = this.getPluginConfigs();
    const modules: DynamicModule[] = [];
    const orderedNames = this.getPluginLoadOrder(Object.keys(pluginConfigs));
    const context = this.buildPluginContext();

    for (const pluginName of orderedNames) {
      const config = pluginConfigs[pluginName];
      if (!config) continue;
      if (!config.enabled) {
        this.logger.log(`Plugin ${pluginName} is disabled, skipping`);
        continue;
      }

      try {
        const plugin = await this.loadPlugin(pluginName, config);
        const module = await plugin.register(context);
        modules.push(module);
        this.loadedPlugins.set(pluginName, plugin);
        this.logger.log(`✓ Loaded plugin: ${plugin.name} v${plugin.version}`);
      } catch (error) {
        this.logger.error(
          `✗ Failed to load plugin ${pluginName}:`,
          error.message,
        );
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
      console.log(`Attempting to load plugin ${pluginName} from npm...`);
      const pluginModule = await import(pluginName);
      // Handle both ES module and CommonJS exports
      const PluginClass = pluginModule.default.default || pluginModule;
      return new PluginClass(config.options);
    } catch (npmError) {
      // Try loading from custom plugin directory or default local directory
      try {
        const pluginDir = process.env.PLUGIN_DIR || '../../plugins';
        const localPath = `${pluginDir}/${pluginName}/dist/index.js`;
        console.log(`Attempting to load plugin ${pluginName} from local path ${localPath}...`);
        const pluginModule = await import(localPath);
        // Handle both ES module and CommonJS exports
        const PluginClass = pluginModule.default.default || pluginModule;
        return new PluginClass(config.options);
      } catch (localError) {
        throw new Error(
          `Plugin ${pluginName} not found in npm or at ${process.env.PLUGIN_DIR || '../../plugins'}/${pluginName} with ${localError}`,
        );
      }
    }
  }

  /**
   * Return plugin names in load order: schema providers first, then consumers (e.g. admin last).
   */
  private getPluginLoadOrder(pluginNames: string[]): string[] {
    const isAdminPlugin = (name: string) =>
      name === 'admin' || name.includes('admin');
    const adminLast = (a: string, b: string) => {
      const aIsAdmin = isAdminPlugin(a);
      const bIsAdmin = isAdminPlugin(b);
      if (aIsAdmin === bIsAdmin) return 0;
      return aIsAdmin ? 1 : -1;
    };
    return [...pluginNames].sort(adminLast);
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
          this.logger.error(
            `✗ Failed to initialize plugin ${name}:`,
            error.message,
          );
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
          this.logger.error(
            `✗ Failed to shutdown plugin ${name}:`,
            error.message,
          );
        }
      }
    }
  }
}
