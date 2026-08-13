import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { VerificationService } from '../verification.service';

@Injectable()
export class VerifiedGuard implements CanActivate {
  constructor(private readonly verificationService: VerificationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.verificationService.isEnforcementEnabled()) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: { id: string } }>();
    const userId = request.user?.id;
    if (!userId) {
      return false;
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
