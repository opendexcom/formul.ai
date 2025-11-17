import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MigrationService } from './migration.service';
import { MigrationController } from './migration.controller';
import { Form, FormSchema } from '../schemas/form.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Form.name, schema: FormSchema }]),
  ],
  controllers: [MigrationController],
  providers: [MigrationService],
  exports: [MigrationService],
})
export class MigrationModule {}