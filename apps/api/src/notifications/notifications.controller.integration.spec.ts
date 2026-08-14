import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@pingme/db';
import { NOTIFICATION_TYPES } from '@pingme/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';

describe('NotificationsController (integration)', () => {
  let controller: NotificationsController;
  let notifications: { sendToUser: jest.Mock };

  async function createModule(nodeEnv: string, testEnabled = 'false') {
    notifications = { sendToUser: jest.fn().mockResolvedValue(undefined) };
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'NODE_ENV') return nodeEnv;
        if (key === 'NOTIFICATIONS_TEST_ENABLED') return testEnabled;
        return fallback;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationService, useValue: notifications },
        { provide: ConfigService, useValue: config },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(NotificationsController);
  }

  it('blocks test push in production by default', async () => {
    await createModule('production');
    await expect(controller.sendTest({ id: 'user-1' } as User)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows test push in production when explicitly enabled', async () => {
    await createModule('production', 'true');
    const result = await controller.sendTest({ id: 'user-1' } as User);
    expect(result.success).toBe(true);
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ type: NOTIFICATION_TYPES.CHAT_MESSAGE }),
    );
  });

  it('allows test push in development', async () => {
    await createModule('development');
    const result = await controller.sendTest({ id: 'user-1' } as User);
    expect(result.success).toBe(true);
  });
});
