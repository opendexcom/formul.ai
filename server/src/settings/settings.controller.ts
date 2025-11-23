import { Controller, Get, Put, Body, UseGuards, UnauthorizedException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('settings')
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    @Get('registration')
    async getRegistrationSetting() {
        const allowed = await this.settingsService.isRegistrationAllowed();
        return { allowRegistration: allowed };
    }

    @Put('registration')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async updateRegistration(@Body('allowRegistration') allowRegistration: boolean) {
        return this.settingsService.updateRegistration(allowRegistration);
    }
}
