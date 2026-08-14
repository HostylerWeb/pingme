import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createCorsOriginDelegate, parseCorsOrigins } from '../common/utils/cors.util';
import { ChatService } from './chat.service';

const wsNodeEnv = process.env.NODE_ENV ?? 'development';
const wsAllowedOrigins = parseCorsOrigins(process.env.CORS_ORIGINS, wsNodeEnv);

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: createCorsOriginDelegate(wsAllowedOrigins, wsNodeEnv),
    credentials: true,
  },
})
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth?.token ?? client.handshake.query?.token) as
        | string
        | undefined;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET', 'dev-secret'),
      });

      client.data.userId = payload.sub;
      const sockets = this.userSockets.get(payload.sub) ?? new Set<string>();
      sockets.add(client.id);
      this.userSockets.set(payload.sub, sockets);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;

    const sockets = this.userSockets.get(userId);
    if (!sockets) return;

    sockets.delete(client.id);
    if (sockets.size === 0) {
      this.userSockets.delete(userId);
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { ok: true });
  }

  @SubscribeMessage('message.send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { chatId?: string; content?: string },
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId || !body.chatId || !body.content?.trim()) {
      return { success: false };
    }

    try {
      const result = await this.chatService.sendMessage(userId, body.chatId, body.content);
      return { success: true, data: result.data };
    } catch (error) {
      this.logger.warn(
        `WS message.send failed: ${error instanceof Error ? error.message : error}`,
      );
      return { success: false };
    }
  }

  emitMessageNew(userId: string, payload: { chatId: string; message: unknown }) {
    const sockets = this.userSockets.get(userId);
    if (!sockets?.size) return;

    for (const socketId of sockets) {
      this.server.to(socketId).emit('message.new', payload);
    }
  }

  isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets?.size;
  }

  emitMatchUpdated(userId: string, payload: { matchId: string; status: string; chatId?: string | null }) {
    const sockets = this.userSockets.get(userId);
    if (!sockets?.size) return;

    for (const socketId of sockets) {
      this.server.to(socketId).emit('match.updated', payload);
    }
  }

  emitIcebreakerInterest(
    userId: string,
    payload: { fromUserId: string; displayName: string },
  ) {
    const sockets = this.userSockets.get(userId);
    if (!sockets?.size) return;

    for (const socketId of sockets) {
      this.server.to(socketId).emit('icebreaker.interest', payload);
    }
  }

  emitMessageRead(
    userId: string,
    payload: { chatId: string; messageIds: string[]; readBy: string; readCount: number },
  ) {
    const sockets = this.userSockets.get(userId);
    if (!sockets?.size) return;

    for (const socketId of sockets) {
      this.server.to(socketId).emit('message.read', payload);
    }
  }

  @SubscribeMessage('message.read')
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { chatId?: string; messageIds?: string[] },
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId || !body.chatId) {
      return { success: false };
    }

    try {
      const result = await this.chatService.markMessagesRead(
        userId,
        body.chatId,
        body.messageIds,
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.warn(
        `WS message.read failed: ${error instanceof Error ? error.message : error}`,
      );
      return { success: false };
    }
  }
}
