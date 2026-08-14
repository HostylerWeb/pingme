import { Injectable } from '@nestjs/common';
import { Prisma, WallPostStatus, WallReplyStatus } from '@pingme/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminWallService {
  constructor(private readonly prisma: PrismaService) {}

  async listPosts(params: {
    status?: WallPostStatus;
    q?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.WallPostWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.q ? { content: { contains: params.q, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.wallPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { include: { profile: { select: { displayName: true } } } },
          _count: { select: { replies: true } },
        },
      }),
      this.prisma.wallPost.count({ where }),
    ]);

    return {
      items: items.map((post) => ({
        id: post.id,
        content: post.content,
        status: post.status,
        replyCount: post._count.replies,
        createdAt: post.createdAt,
        userId: post.userId,
        authorDisplayName: post.user.profile?.displayName ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  async listReplies(params: {
    status?: WallReplyStatus;
    postId?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.WallReplyWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.postId ? { postId: params.postId } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.wallReply.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { include: { profile: { select: { displayName: true } } } },
          post: { select: { id: true, content: true } },
        },
      }),
      this.prisma.wallReply.count({ where }),
    ]);

    return {
      items: items.map((reply) => ({
        id: reply.id,
        content: reply.content,
        status: reply.status,
        postId: reply.postId,
        postContent: reply.post.content,
        createdAt: reply.createdAt,
        userId: reply.userId,
        authorDisplayName: reply.user.profile?.displayName ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  async restorePost(id: string) {
    return this.prisma.wallPost.update({
      where: { id },
      data: { status: WallPostStatus.active },
    });
  }

  async restoreReply(id: string) {
    return this.prisma.wallReply.update({
      where: { id },
      data: { status: WallReplyStatus.active },
    });
  }

  async deletePost(id: string) {
    return this.prisma.wallPost.update({
      where: { id },
      data: { status: WallPostStatus.deleted },
    });
  }

  async hidePost(id: string) {
    return this.prisma.wallPost.update({
      where: { id },
      data: { status: WallPostStatus.hidden },
    });
  }

  async deleteReply(id: string) {
    return this.prisma.wallReply.update({
      where: { id },
      data: { status: WallReplyStatus.deleted },
    });
  }

  async hideReply(id: string) {
    return this.prisma.wallReply.update({
      where: { id },
      data: { status: WallReplyStatus.hidden },
    });
  }
}
