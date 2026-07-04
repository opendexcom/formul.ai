import { Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for current user' })
  async findAll(@Request() req) {
    const userId = req.user._id || req.user.id;
    const [items, unreadCount] = await Promise.all([
      this.notificationsService.findForUser(userId),
      this.notificationsService.countUnread(userId),
    ]);
    return { items, unreadCount };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(@Param('id') id: string, @Request() req) {
    const userId = req.user._id || req.user.id;
    return this.notificationsService.markRead(userId, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@Request() req) {
    const userId = req.user._id || req.user.id;
    return this.notificationsService.markAllRead(userId);
  }
}
