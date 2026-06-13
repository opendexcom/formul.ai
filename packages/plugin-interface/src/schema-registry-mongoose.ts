import { MongooseModule } from '@nestjs/mongoose';
import { markSchemaCompiled, registerSchemas } from './schema-registry';
import type { SchemaDefinition } from './schema-registry';

/**
 * Registers schemas in the shared registry and returns MongooseModule.forFeature(...)
 * so they can be used in Nest module imports in one step.
 * Requires @nestjs/mongoose to be installed.
 */
export function registerSchemaWithRegistry(
    definitions: Array<SchemaDefinition>,
): ReturnType<typeof MongooseModule.forFeature> {
    registerSchemas(definitions);
    for (const definition of definitions) {
        markSchemaCompiled(definition.name);
    }
    return MongooseModule.forFeature(
        definitions.map((d) => ({ name: d.name, schema: d.schema })),
    );
}
