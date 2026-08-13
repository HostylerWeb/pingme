import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateWallPostSchema,
  CreateWallReplySchema,
  CreateWallPostInput,
  CreateWallReplyInput,
} from '@pingme/shared';
import { User } from '@pingme/db';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerifiedGuard } from '../verification/guards/verified.guard';
import { WallService } from './wall.service';

@ApiTags('wall')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wall')
export class WallController {
  constructor(private readonly wallService: WallService) {}

  @Get('posts')
  @ApiOperation({ summary: 'List nearby wall posts' })
  listPosts(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.wallService.listPosts(
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Post('posts')
  @UseGuards(VerifiedGuard)
  @ApiOperation({ summary: 'Create wall post' })
  createPost(@CurrentUser() user: User, @Body(new ZodValidationPipe(CreateWallPostSchema)) dto: CreateWallPostInput) {
    return this.wallService.createPost(user.id, dto);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Get post with replies' })
  getPost(@CurrentUser() user: User, @Param('id') postId: string) {
    return this.wallService.getPost(user.id, postId);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Delete own post' })
  deletePost(@CurrentUser() user: User, @Param('id') postId: string) {
    return this.wallService.deletePost(user.id, postId);
  }

  @Post('posts/:id/replies')
  @UseGuards(VerifiedGuard)
  @ApiOperation({ summary: 'Reply to post' })
  createReply(
    @CurrentUser() user: User,
    @Param('id') postId: string,
    @Body(new ZodValidationPipe(CreateWallReplySchema)) dto: CreateWallReplyInput,
  ) {
    return this.wallService.createReply(user.id, postId, dto);
  }

  @Delete('replies/:id')
  @ApiOperation({ summary: 'Delete own reply' })
  deleteReply(@CurrentUser() user: User, @Param('id') replyId: string) {
    return this.wallService.deleteReply(user.id, replyId);
  }
}
