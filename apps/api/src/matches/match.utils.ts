import { IcebreakerSessionStatus, MatchStatus } from '@pingme/db';
import { PrismaClient } from '@pingme/db';

type PrismaTransaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export async function activateMatchIfReady(tx: PrismaTransaction, matchId: string) {
  const match = await tx.match.findUnique({
    where: { id: matchId },
    include: { chat: { select: { id: true } } },
  });
  if (!match) return null;

  if (match.userAAcceptedAt && match.userBAcceptedAt) {
    if (match.status === MatchStatus.pending) {
      await tx.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.active },
      });
    }
    await tx.chat.upsert({
      where: { matchId },
      create: { matchId },
      update: {},
    });
    return tx.match.findUnique({
      where: { id: matchId },
      include: { chat: { select: { id: true } } },
    });
  }

  return match;
}

export async function resetIcebreakerSessionsForMatch(
  tx: PrismaTransaction,
  source: string,
  sourceReferenceId: string | null,
) {
  if (source !== 'icebreaker' || !sourceReferenceId) return;

  const session = await tx.icebreakerSession.findUnique({
    where: { id: sourceReferenceId },
  });
  if (!session?.matchedSessionId) return;

  await tx.icebreakerSession.updateMany({
    where: { id: { in: [session.id, session.matchedSessionId] } },
    data: { status: IcebreakerSessionStatus.cancelled },
  });
}
