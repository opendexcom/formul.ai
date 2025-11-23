import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SettingsDocument = Settings & Document;

@Schema({ timestamps: true })
export class Settings {
    @Prop({ default: true })
    allowRegistration: boolean;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
