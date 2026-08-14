import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NOTIFICATION_TYPES } from '@pingme/shared';
import { DevicesService } from '../devices/devices.service';
import { PushPayload } from './notification.service';

@Injectable()
export class PushSenderService {
  private readonly logger = new Logger(PushSenderService.name);

  constructor(
    private readonly devices: DevicesService,
    private readonly config: ConfigService,
  ) {}

  async deliver(userId: string, payload: PushPayload) {
    const tokens = await this.devices.getTokensForUser(userId);
    if (tokens.length === 0) {
      this.logger.log(`[DEV] No push tokens for user ${userId}: ${payload.title}`);
      return;
    }

    const pushEnabled = this.config.get<string>('PUSH_ENABLED', 'false') === 'true';
    if (!pushEnabled) {
      this.logger.log(
        `[DEV] Push to user ${userId} (${tokens.length} devices): ${payload.title} — ${payload.body}`,
      );
      return;
    }

    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data,
      channelId: payload.type === NOTIFICATION_TYPES.WALL_REPLY ? 'wall-replies' : 'default',
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Expo push failed: ${response.status} ${text}`);
    }
  }
}
