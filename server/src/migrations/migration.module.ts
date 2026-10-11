import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MigrationService } from './migration.service';
import { MigrationController } from './migration.controller';
import { Form } from '../schemas/form.schema';
import { Project } from '../schemas/project.schema';
import { Response } from '../schemas/response.schema';
import { getCoreSchemaOrThrow } from '../schemas/core-schema-registry';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Form.name, schema: getCoreSchemaOrThrow(Form.name) },
      { name: Project.name, schema: getCoreSchemaOrThrow(Project.name) },
      { name: Response.name, schema: getCoreSchemaOrThrow(Response.name) },
    ]),
  ],
  controllers: [MigrationController],
  providers: [MigrationService],
  exports: [MigrationService],
})
export class MigrationModule {}
