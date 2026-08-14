import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole } from '@pingme/db';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminAdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const admins = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { auditLogs: true, assignedReports: true } },
      },
    });

    return {
      items: admins.map((admin) => ({
        id: admin.id,
        email: admin.email,
        role: admin.role,
        createdAt: admin.createdAt,
        actionCount: admin._count.auditLogs,
        assignedReportCount: admin._count.assignedReports,
      })),
    };
  }

  async create(data: { email: string; password: string; role: AdminRole }) {
    const email = data.email.toLowerCase().trim();
    const existing = await this.prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Admin account already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    return this.prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        role: data.role,
      },
      select: { id: true, email: true, role: true, createdAt: true },
    });
  }

  async update(id: string, data: { role?: AdminRole; password?: string }) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return this.prisma.adminUser.update({
      where: { id },
      data: {
        ...(data.role ? { role: data.role } : {}),
        ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 12) } : {}),
      },
      select: { id: true, email: true, role: true, createdAt: true },
    });
  }

  async remove(id: string, currentAdminId: string) {
    if (id === currentAdminId) {
      throw new ConflictException('Cannot delete your own account');
    }

    const admin = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    await this.prisma.adminUser.delete({ where: { id } });
    return { success: true };
  }
}
