import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminRole, WallPostStatus, WallReplyStatus } from '@pingme/db';
import { Public } from '../../common/decorators/public.decorator';
import { AdminAuditService } from '../admin-audit.service';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AdminWallService } from './admin-wall.service';

@Public()
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles(AdminRole.moderator, AdminRole.super_admin)
@Controller('admin/wall')
export class AdminWallController {
  constructor(
    private readonly wall: AdminWallService,
    private readonly adminAudit: AdminAuditService,
  ) {}

  @Get('posts')
  listPosts(
    @Query('status') status?: WallPostStatus,
    @Query('q') q?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.wall.listPosts({
      status,
      q,
      userId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('replies')
  listReplies(
    @Query('status') status?: WallReplyStatus,
    @Query('postId') postId?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.wall.listReplies({
      status,
      postId,
      userId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch('posts/:id/restore')
  async restorePost(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: { id: string },
  ) {
    const post = await this.wall.restorePost(id);
    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'wall.post.restore',
      entityType: 'wall_post',
      entityId: id,
    });
    return post;
  }

  @Patch('replies/:id/restore')
  async restoreReply(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: { id: string },
  ) {
    const reply = await this.wall.restoreReply(id);
    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'wall.reply.restore',
      entityType: 'wall_reply',
      entityId: id,
    });
    return reply;
  }

  @Delete('posts/:id')
  async deletePost(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: { id: string },
  ) {
    const post = await this.wall.deletePost(id);
    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'wall.post.delete',
      entityType: 'wall_post',
      entityId: id,
    });
    return post;
  }

  @Patch('posts/:id/hide')
  async hidePost(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: { id: string },
  ) {
    const post = await this.wall.hidePost(id);
    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'wall.post.hide',
      entityType: 'wall_post',
      entityId: id,
    });
    return post;
  }

  @Delete('replies/:id')
  async deleteReply(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: { id: string },
  ) {
    const reply = await this.wall.deleteReply(id);
    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'wall.reply.delete',
      entityType: 'wall_reply',
      entityId: id,
    });
    return reply;
  }

  @Patch('replies/:id/hide')
  async hideReply(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: { id: string },
  ) {
    const reply = await this.wall.hideReply(id);
    await this.adminAudit.log({
      adminUserId: admin.id,
      action: 'wall.reply.hide',
      entityType: 'wall_reply',
      entityId: id,
    });
    return reply;
  }
}
