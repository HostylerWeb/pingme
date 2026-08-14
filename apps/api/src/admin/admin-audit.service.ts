import { Injectable } from '@nestjs/common';
import { Prisma } from '@pingme/db';
import { PrismaService } from '../prisma/prisma.service';

export interface AdminAuditLogInput {
  adminUserId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AdminAuditLogInput) {
    await this.prisma.adminAuditLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
      },
    });
  }
}
