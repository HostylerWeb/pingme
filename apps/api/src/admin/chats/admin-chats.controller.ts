import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { AdminRole } from '@pingme/db';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AdminChatsService } from './admin-chats.service';

@Public()
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles(AdminRole.moderator, AdminRole.super_admin)
@Controller('admin/chats')
export class AdminChatsController {
  constructor(private readonly chats: AdminChatsService) {}

  @Get(':id/messages')
  getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chats.getMessages(
      id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }
}
