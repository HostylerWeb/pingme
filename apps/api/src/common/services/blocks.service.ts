import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus } from '@pingme/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.prisma.block.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
      select: { blockerId: true, blockedId: true },
    });

    const ids = new Set<string>();
    for (const block of blocks) {
      if (block.blockerId === userId) ids.add(block.blockedId);
      if (block.blockedId === userId) ids.add(block.blockerId);
    }
    return [...ids];
  }

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const user = await this.prisma.user.findUnique({ where: { id: blockedId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
    if (existing) {
      throw new ConflictException('User already blocked');
    }

    const block = await this.prisma.$transaction(async (tx) => {
      const created = await tx.block.create({
        data: { blockerId, blockedId },
      });

      await tx.icebreakerInterest.deleteMany({
        where: {
          OR: [
            { fromUserId: blockerId, toUserId: blockedId },
            { fromUserId: blockedId, toUserId: blockerId },
          ],
        },
      });

      const [userAId, userBId] =
        blockerId < blockedId ? [blockerId, blockedId] : [blockedId, blockerId];
      await tx.match.updateMany({
        where: {
          userAId,
          userBId,
          status: MatchStatus.pending,
        },
        data: { status: MatchStatus.declined },
      });

      return created;
    });

    return { success: true, data: block };
  }

  async unblockUser(blockerId: string, blockedId: string) {
    const existing = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
    if (!existing) {
      throw new NotFoundException('Block not found');
    }

    await this.prisma.block.delete({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });

    return { success: true };
  }

  async listBlockedUsers(blockerId: string) {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId },
      include: {
        blocked: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: blocks.map((block) => ({
        userId: block.blockedId,
        displayName: block.blocked.profile?.displayName ?? 'User',
        blockedAt: block.createdAt,
      })),
    };
  }
}
