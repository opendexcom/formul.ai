import { Controller, Post, Get, Query, UseGuards } from '@nestjs/common';
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

  @Post('forms-to-projects')
  @ApiOperation({ summary: 'Migrate legacy forms to one project per form' })
  @ApiResponse({ status: 200, description: 'Forms to projects migration finished' })
  async migrateFormsToProjects(@Query('dryRun') dryRun?: string) {
    const result = await this.migrationService.migrateFormsToProjects(
      dryRun === 'true',
    );
    return {
      message: dryRun === 'true' ? 'Dry run finished' : 'Migration finished',
      ...result,
    };
  }
}