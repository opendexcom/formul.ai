import { DynamicModule, INestApplication, Type } from '@nestjs/common';
import type { PluginContributionRegistry } from './plugin-contributions';

/** Nest modules the host exposes to plugins (decoupled from plugin package imports). */
export interface PluginHostModules {
    /** AI services without HTTP controllers (AiService, GuardianService). */
    aiCore?: Type<unknown>;
}

/**
 * Context passed by the host to every plugin at register() time.
 * Contains references to the host's schema registry so all plugins
 * share a single registry instance regardless of module resolution.
 */
export interface PluginContext {
    schemaRegistry: {
        register<S = unknown>(name: string, schema: S): S;
        extend(name: string, definition: Record<string, unknown>): void;
        get<S = unknown>(name: string): S | undefined;
        getOrThrow<S = unknown>(name: string): S;
        has(name: string): boolean;
    };
    capabilities?: {
        register(name: string): void;
    };
    /** Optional host Nest modules plugins may import (e.g. AiCoreModule). */
    hostModules?: PluginHostModules;
}

/**
 * Interface that all FormulAI plugins must implement
 */
export interface FormulAIPlugin {
    /**
     * Plugin metadata
     */
    name: string;
    version: string;
    description?: string;

    /**
     * Return a NestJS dynamic module to be imported.
     * This method is called during application bootstrap.
     *
     * @param context – host-provided context containing the shared schema
     *                  registry. Plugins MUST use context.schemaRegistry
     *                  instead of importing registry functions directly so
     *                  that all plugins and core share the same Map instance.
     */
    register(context?: PluginContext): DynamicModule | Promise<DynamicModule>;

    /**
     * Optional: register cross-cutting hooks (e.g. registration validation).
     * Called after register() during plugin load.
     */
    contribute?(contributions: PluginContributionRegistry): void | Promise<void>;

    /**
     * Optional: Initialize plugin after app bootstrap
     * Use for setting up middleware, global filters, etc.
     */
    onApplicationBootstrap?(app: INestApplication): Promise<void>;

    /**
     * Optional: Cleanup on app shutdown
     */
    onApplicationShutdown?(): Promise<void>;
}

/**
 * Plugin configuration from environment
 */
export interface PluginConfig {
    enabled: boolean;
    options?: Record<string, any>;
}

export {
    clearSchemaRegistry,
    extendSchema,
    getAllSchemas,
    getSchema,
    getSchemaOrThrow,
    hasSchema,
    isSchemaCompiled,
    markSchemaCompiled,
    registerSchema,
    registerSchemas,
} from './schema-registry';

export type {
    RegisteredSchema,
    SchemaDefinition,
    SchemaExtensionFields,
} from './schema-registry';

export {
    clearCapabilityRegistry,
    getCapabilities,
    hasCapability,
    registerCapability,
} from './capability-registry';

export { registerSchemaWithRegistry } from './schema-registry-mongoose';

export type {
    RegisteredUserRef,
    RegistrationExtension,
    PluginContributionRegistry,
} from './plugin-contributions';

export {
    DefaultPluginContributionRegistry,
    PLUGIN_CONTRIBUTION_REGISTRY,
} from './plugin-contributions';
