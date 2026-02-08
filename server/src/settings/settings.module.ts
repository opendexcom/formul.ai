import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { Settings } from './schemas/settings.schema';
import { getCoreSchemaOrThrow } from '../schemas/core-schema-registry';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Settings.name, schema: getCoreSchemaOrThrow(Settings.name) }]),
    ],
    controllers: [SettingsController],
    providers: [SettingsService],
    exports: [SettingsService],
})
export class SettingsModule { }
