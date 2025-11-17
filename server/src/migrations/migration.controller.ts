import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MigrationService } from './migration.service';

@ApiTags('Migrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('migrations')
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  @Post('fix-created-by')
  @ApiOperation({ summary: 'Fix forms with populated createdBy fields' })
  @ApiResponse({ status: 200, description: 'Migration completed successfully' })
  async fixCreatedByFields() {
    await this.migrationService.fixFormCreatedByFields();
    return { message: 'Migration completed successfully' };
  }

  @Get('validate-created-by')
  @ApiOperation({ summary: 'Validate form createdBy fields' })
  @ApiResponse({ status: 200, description: 'Validation completed' })
  async validateCreatedByFields() {
    await this.migrationService.validateFormCreatedByFields();
    return { message: 'Validation completed - check server logs' };
  }

  @Get('show-problematic')
  @ApiOperation({ summary: 'Show forms with incorrect structure' })
  @ApiResponse({ status: 200, description: 'Problematic forms listed' })
  async showProblematicForms() {
    await this.migrationService.showProblematicForms();
    return { message: 'Problematic forms listed - check server logs' };
  }
}