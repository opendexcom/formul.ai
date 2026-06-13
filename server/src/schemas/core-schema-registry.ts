import { getSchemaOrThrow, registerSchema, markSchemaCompiled } from '@opendexcom/plugin-interface';
import { Schema } from 'mongoose';
import { Settings, SettingsSchema } from '../settings/schemas/settings.schema';
import { AnalyticsTaskSchema } from './analytics-task.schema';
import { FormLockSchema } from './form-lock.schema';
import { Form, FormSchema } from './form.schema';
import { Response, ResponseSchema } from './response.schema';
import { User, UserSchema } from './user.schema';

type SchemaDefinition = {
  name: string;
  schema: Schema;
};

const coreSchemaDefinitions: SchemaDefinition[] = [
  { name: User.name, schema: UserSchema },
  { name: Form.name, schema: FormSchema },
  { name: Response.name, schema: ResponseSchema },
  { name: 'AnalyticsTask', schema: AnalyticsTaskSchema },
  { name: 'FormLock', schema: FormLockSchema },
  { name: Settings.name, schema: SettingsSchema },
];

let isCoreSchemaRegistryInitialized = false;

export function registerCoreSchemas(): void {
  if (isCoreSchemaRegistryInitialized) {
    return;
  }

  for (const definition of coreSchemaDefinitions) {
    registerSchema(definition.name, definition.schema);
  }

  isCoreSchemaRegistryInitialized = true;
}

export function getCoreSchemaOrThrow(name: string): Schema {
  registerCoreSchemas();
  markSchemaCompiled(name);
  return getSchemaOrThrow<Schema>(name);
}
