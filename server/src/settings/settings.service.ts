import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Settings, SettingsDocument } from './schemas/settings.schema';

@Injectable()
export class SettingsService {
    constructor(
        @InjectModel(Settings.name) private settingsModel: Model<SettingsDocument>,
    ) { }

    private resolveAllowRegistration(stored: boolean): boolean {
        const env = process.env.ALLOW_REGISTRATION?.trim().toLowerCase();
        if (env === 'true' || env === '1') return true;
        if (env === 'false' || env === '0') return false;
        return stored;
    }

    async getSettings(): Promise<Settings> {
        let settings = await this.settingsModel.findOne();
        if (!settings) {
            settings = await this.settingsModel.create({ allowRegistration: true });
        }
        return settings;
    }

    async updateRegistration(allowRegistration: boolean): Promise<Settings> {
        let settings = await this.settingsModel.findOne();
        if (!settings) {
            settings = await this.settingsModel.create({ allowRegistration });
        } else {
            settings.allowRegistration = allowRegistration;
            await settings.save();
        }
        return settings;
    }

    async isRegistrationAllowed(): Promise<boolean> {
        const settings = await this.getSettings();
        return this.resolveAllowRegistration(settings.allowRegistration);
    }
}
