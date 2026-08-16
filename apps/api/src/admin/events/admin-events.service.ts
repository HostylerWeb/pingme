import { Injectable } from '@nestjs/common';
import { EventStatus, Prisma } from '@pingme/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async listEvents(params: {
    status?: EventStatus;
    q?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.EventWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.q
        ? {
            OR: [
              { title: { contains: params.q, mode: 'insensitive' } },
              { description: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startsAt: 'desc' },
        include: {
          user: {
            include: {
              profile: { select: { displayName: true } },
              verifications: {
                where: {
                  OR: [
                    { type: 'liveness', status: 'passed' },
                    { type: 'document', status: 'passed' },
                  ],
                },
                select: { type: true, status: true },
              },
            },
          },
          images: { where: { isCover: true }, take: 1 },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      items: items.map((event) => ({
        id: event.id,
        title: event.title,
        status: event.status,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        goingCount: event.goingCount,
        maybeCount: event.maybeCount,
        commentCount: event.commentCount,
        createdAt: event.createdAt,
        userId: event.userId,
        hostDisplayName: event.user.profile?.displayName ?? null,
        coverUrl: event.images[0]?.url ?? null,
        hostLivenessVerified: event.user.verifications.some(
          (v) => v.type === 'liveness' && v.status === 'passed',
        ),
        hostIdVerified: event.user.verifications.some(
          (v) => v.type === 'document' && v.status === 'passed',
        ),
      })),
      total,
      page,
      limit,
    };
  }

  async hideEvent(eventId: string) {
    return this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.hidden },
    });
  }

  async restoreEvent(eventId: string) {
    return this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.active },
    });
  }

  async deleteEvent(eventId: string) {
    return this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.deleted },
    });
  }
}
