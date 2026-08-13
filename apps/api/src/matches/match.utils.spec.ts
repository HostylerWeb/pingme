import { activateMatchIfReady } from './match.utils';
import { MatchStatus } from '@pingme/db';

describe('activateMatchIfReady', () => {
  it('creates chat once when both users accepted', async () => {
    const matchId = 'match-1';
    const state: {
      id: string;
      status: MatchStatus;
      userAAcceptedAt: Date;
      userBAcceptedAt: Date;
      chat: { id: string } | null;
    } = {
      id: matchId,
      status: MatchStatus.pending,
      userAAcceptedAt: new Date(),
      userBAcceptedAt: new Date(),
      chat: null,
    };

    const tx = {
      match: {
        findUnique: jest.fn(async () => ({ ...state, chat: state.chat })),
        update: jest.fn(async () => {
          state.status = MatchStatus.active;
          return state;
        }),
      },
      chat: {
        upsert: jest.fn(async () => {
          state.chat = { id: 'chat-1' };
          return state.chat;
        }),
      },
    };

    const result = await activateMatchIfReady(tx as never, matchId);

    expect(tx.chat.upsert).toHaveBeenCalledTimes(1);
    expect(result?.chat?.id).toBe('chat-1');
  });

  it('is idempotent when chat already exists', async () => {
    const matchId = 'match-2';
    const state: {
      id: string;
      status: MatchStatus;
      userAAcceptedAt: Date;
      userBAcceptedAt: Date;
      chat: { id: string };
    } = {
      id: matchId,
      status: MatchStatus.active,
      userAAcceptedAt: new Date(),
      userBAcceptedAt: new Date(),
      chat: { id: 'chat-2' },
    };

    const tx = {
      match: {
        findUnique: jest.fn(async () => ({ ...state })),
        update: jest.fn(),
      },
      chat: {
        upsert: jest.fn(async () => state.chat),
      },
    };

    await activateMatchIfReady(tx as never, matchId);
    await activateMatchIfReady(tx as never, matchId);

    expect(tx.chat.upsert).toHaveBeenCalledTimes(2);
    expect(tx.match.update).not.toHaveBeenCalled();
  });
});
