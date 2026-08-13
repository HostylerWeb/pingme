import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SendMessageInput, SendMessageSchema } from '@pingme/shared';
import { User } from '@pingme/db';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerifiedGuard } from '../verification/guards/verified.guard';
import { ChatService } from './chat.service';

@ApiTags('chats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'List active chats' })
  list(@CurrentUser() user: User) {
    return this.chatService.listChats(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get chat detail' })
  get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.chatService.getChat(user.id, id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List chat messages' })
  messages(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.listMessages(
      user.id,
      id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }

  @Post(':id/messages')
  @UseGuards(VerifiedGuard)
  @ApiOperation({ summary: 'Send a message' })
  send(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SendMessageSchema)) dto: SendMessageInput,
  ) {
    return this.chatService.sendMessage(user.id, id, dto.content);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close chat' })
  close(@CurrentUser() user: User, @Param('id') id: string) {
    return this.chatService.closeChat(user.id, id);
  }
}
