import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@pingme/db';
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
import { RateLimitService } from '../common/services/rate-limit.service';
import { createCorsOriginDelegate, parseCorsOrigins } from '../common/utils/cors.util';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

const wsNodeEnv = process.env.NODE_ENV ?? 'development';
const wsAllowedOrigins = parseCorsOrigins(process.env.CORS_ORIGINS, wsNodeEnv);
const WS_MESSAGE_SEND_LIMIT = 30;
const WS_CONNECT_LIMIT = 30;
const WS_MESSAGE_MAX_LENGTH = 2000;

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
    private readonly rateLimit: RateLimitService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {}

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  async handleConnection(client: Socket) {
    try {
      const ip = client.handshake.address;
      const connectAllowed = await this.rateLimit.incrementWithinWindow(
        `rate:ws:connect:${ip}`,
        WS_CONNECT_LIMIT,
        60,
      );
      if (!connectAllowed) {
        client.disconnect();
        return;
      }

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

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { deletedAt: true, status: true },
      });

      if (
        !user ||
        user.deletedAt != null ||
        user.status === UserStatus.suspended ||
        user.status === UserStatus.deleted
      ) {
        client.disconnect();
        return;
      }

      client.data.userId = payload.sub;
      await client.join(this.userRoom(payload.sub));
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
    const content = body.content?.trim();
    if (!userId || !body.chatId || !content) {
      return { success: false };
    }

    if (content.length > WS_MESSAGE_MAX_LENGTH) {
      return { success: false, error: 'Message too long' };
    }

    const sendAllowed = await this.rateLimit.incrementWithinWindow(
      `rate:ws:send:${userId}`,
      WS_MESSAGE_SEND_LIMIT,
      60,
    );
    if (!sendAllowed) {
      return { success: false, error: 'Rate limit exceeded' };
    }

    try {
      const result = await this.chatService.sendMessage(userId, body.chatId, content);
      return { success: true, data: result.data };
    } catch (error) {
      this.logger.warn(
        `WS message.send failed: ${error instanceof Error ? error.message : error}`,
      );
      return { success: false };
    }
  }

  emitMessageNew(userId: string, payload: { chatId: string; message: unknown }) {
    this.server.to(this.userRoom(userId)).emit('message.new', payload);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const sockets = await this.server.in(this.userRoom(userId)).fetchSockets();
    return sockets.length > 0;
  }

  emitMatchUpdated(userId: string, payload: { matchId: string; status: string; chatId?: string | null }) {
    this.server.to(this.userRoom(userId)).emit('match.updated', payload);
  }

  emitIcebreakerInterest(
    userId: string,
    payload: { fromUserId: string; displayName: string },
  ) {
    this.server.to(this.userRoom(userId)).emit('icebreaker.interest', payload);
  }

  emitMessageRead(
    userId: string,
    payload: { chatId: string; messageIds: string[]; readBy: string; readCount: number },
  ) {
    this.server.to(this.userRoom(userId)).emit('message.read', payload);
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
