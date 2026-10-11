import type { Schema } from 'mongoose';

export type RegisteredSchema = unknown;

export interface SchemaDefinition<S = RegisteredSchema> {
    name: string;
    schema: S;
}

export type SchemaExtensionFields = Record<string, unknown>;

const schemaRegistry = new Map<string, RegisteredSchema>();
const compiledSchemaNames = new Set<string>();

export function markSchemaCompiled(name: string): void {
    compiledSchemaNames.add(name);
}

export function markAllSchemasCompiled(): void {
    for (const name of schemaRegistry.keys()) {
        compiledSchemaNames.add(name);
    }
}

export function isSchemaCompiled(name: string): boolean {
    return compiledSchemaNames.has(name);
}

export function registerSchema<S = RegisteredSchema>(name: string, schema: S): S {
    if (!name || typeof name !== 'string') {
        throw new Error('Schema name must be a non-empty string.');
    }

    const existingSchema = schemaRegistry.get(name);

    if (existingSchema !== undefined) {
        if (existingSchema === schema) {
            return schema;
        }

        throw new Error(`Schema \"${name}\" is already registered.`);
    }

    schemaRegistry.set(name, schema as RegisteredSchema);

    return schema;
}

export function extendSchema(
    name: string,
    definition: SchemaExtensionFields,
): void {
    if (!name || typeof name !== 'string') {
        throw new Error('Schema name must be a non-empty string.');
    }

    if (isSchemaCompiled(name)) {
        throw new Error(
            `Schema \"${name}\" is already compiled; extend must run before MongooseModule.forFeature.`,
        );
    }

    const schema = schemaRegistry.get(name);
    if (schema === undefined) {
        throw new Error(`Schema \"${name}\" is not registered; register it before extending.`);
    }

    if (typeof (schema as Schema).add !== 'function') {
        throw new Error(`Schema \"${name}\" does not support extend (expected Mongoose Schema).`);
    }

    (schema as Schema).add(definition);
}

export function registerSchemas<S = RegisteredSchema>(definitions: Array<SchemaDefinition<S>>): Array<SchemaDefinition<S>> {
    for (const definition of definitions) {
        registerSchema(definition.name, definition.schema);
    }

    return definitions;
}

export function getSchema<S = RegisteredSchema>(name: string): S | undefined {
    return schemaRegistry.get(name) as S | undefined;
}

export function getSchemaOrThrow<S = RegisteredSchema>(name: string): S {
    const schema = getSchema<S>(name);

    if (schema === undefined) {
        throw new Error(`Schema \"${name}\" is not registered.`);
    }

    return schema;
}

export function getAllSchemas<S = RegisteredSchema>(): Record<string, S> {
    return Object.fromEntries(schemaRegistry.entries()) as Record<string, S>;
}

export function hasSchema(name: string): boolean {
    return schemaRegistry.has(name);
}

export function clearSchemaRegistry(): void {
    schemaRegistry.clear();
}
