import { Injectable, NotFoundException } from '@nestjs/common';
import { EventStatus, Prisma } from '@pingme/db';
import { eventRsvpWithdrawalReasonLabel } from '@pingme/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async listEvents(params: {
    status?: EventStatus;
    lifecycle?: 'ended' | 'upcoming';
    q?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.EventWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.lifecycle === 'ended'
        ? { status: EventStatus.active, endsAt: { lt: now } }
        : {}),
      ...(params.lifecycle === 'upcoming'
        ? { status: EventStatus.active, endsAt: { gte: now } }
        : {}),
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
          _count: { select: { withdrawals: true } },
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
        withdrawalCount: event._count.withdrawals,
        isEnded: event.status === EventStatus.active && event.endsAt < now,
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

  async getEvent(eventId: string) {
    const now = new Date();
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
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
        images: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { withdrawals: true, comments: true, rsvps: true } },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      status: event.status,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      placeName: event.placeName,
      address: event.address,
      latitude: event.latitude,
      longitude: event.longitude,
      goingCount: event.goingCount,
      maybeCount: event.maybeCount,
      commentCount: event.commentCount,
      withdrawalCount: event._count.withdrawals,
      rsvpCount: event._count.rsvps,
      allowMessages: event.allowMessages,
      isEnded: event.status === EventStatus.active && event.endsAt < now,
      createdAt: event.createdAt,
      userId: event.userId,
      hostDisplayName: event.user.profile?.displayName ?? null,
      coverUrl: event.images.find((image) => image.isCover)?.url ?? event.images[0]?.url ?? null,
      images: event.images.map((image) => ({
        id: image.id,
        url: image.url,
        isCover: image.isCover,
      })),
      hostLivenessVerified: event.user.verifications.some(
        (v) => v.type === 'liveness' && v.status === 'passed',
      ),
      hostIdVerified: event.user.verifications.some(
        (v) => v.type === 'document' && v.status === 'passed',
      ),
    };
  }

  async listWithdrawals(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true },
    });
    if (!event) {
      return { items: [], total: 0 };
    }

    const withdrawals = await this.prisma.eventRsvpWithdrawal.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          include: {
            profile: { select: { displayName: true } },
          },
        },
      },
    });

    return {
      event: { id: event.id, title: event.title },
      items: withdrawals.map((withdrawal) => ({
        id: withdrawal.id,
        userId: withdrawal.userId,
        displayName: withdrawal.user.profile?.displayName ?? 'User',
        previousStatus: withdrawal.previousStatus,
        reasonCode: withdrawal.reasonCode,
        reasonLabel: eventRsvpWithdrawalReasonLabel(withdrawal.reasonCode),
        reasonDetail: withdrawal.reasonDetail,
        createdAt: withdrawal.createdAt,
      })),
      total: withdrawals.length,
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
