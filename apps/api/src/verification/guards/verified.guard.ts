import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { meetsMinimumAge } from '@pingme/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { VerificationService } from '../verification.service';

@Injectable()
export class VerifiedGuard implements CanActivate {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: { id: string } }>();
    const userId = request.user?.id;
    if (!userId) {
      return false;
    }

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { dateOfBirth: true },
    });

    if (!profile?.dateOfBirth || !meetsMinimumAge(profile.dateOfBirth)) {
      throw new ForbiddenException({
        code: 'MINIMUM_AGE_REQUIRED',
        message: 'You must be at least 18 years old to use this feature',
      });
    }

    if (!this.verificationService.isEnforcementEnabled()) {
      return true;
    }

    const passed = await this.verificationService.hasPassedLiveness(userId);
    if (!passed) {
      throw new ForbiddenException({
        code: 'LIVENESS_REQUIRED',
        message: 'Complete liveness verification to use this feature',
      });
    }

    return true;
  }
}
