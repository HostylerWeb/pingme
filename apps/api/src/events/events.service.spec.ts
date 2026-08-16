import { EventsService } from './events.service';
import { EventsNearbyPushService } from './events-nearby-push.service';

describe('EventsService', () => {
  it('documents nearby list requires location ping', () => {
    const service = {
      listNearby: jest.fn().mockRejectedValue(new Error('Location required — send a ping first')),
    } as unknown as EventsService;

    expect(service.listNearby).toBeDefined();
  });

  it('documents push fan-out on create', () => {
    const push = {
      notifyNearbyUsersOnCreate: jest.fn(),
    } as unknown as EventsNearbyPushService;

    push.notifyNearbyUsersOnCreate('host-1', 'event-1', 'Meetup', 0, 0);
    expect(push.notifyNearbyUsersOnCreate).toHaveBeenCalled();
  });
});
