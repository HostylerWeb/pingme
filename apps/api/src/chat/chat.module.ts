import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlocksService } from '../common/services/blocks.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { VerificationModule } from '../verification/verification.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Module({
  imports: [NotificationsModule, AuthModule, VerificationModule],
  controllers: [ChatController],
  providers: [ChatService, BlocksService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
