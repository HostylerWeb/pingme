import { isPrismaUniqueConflict } from '../common/utils/prisma-error.util';
import { EventsService } from './events.service';
import { EventsNearbyPushService } from './events-nearby-push.service';

describe('EventsService', () => {
  it('is defined as a class', () => {
    expect(EventsService).toBeDefined();
    expect(EventsNearbyPushService).toBeDefined();
  });

  it('treats Prisma unique conflicts as recoverable for message-host', () => {
    expect(isPrismaUniqueConflict({ code: 'P2002' })).toBe(true);
  });
});
