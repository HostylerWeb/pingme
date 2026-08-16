import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { VerificationService } from '../verification.service';

@Injectable()
export class IdVerifiedGuard implements CanActivate {
  constructor(private readonly verificationService: VerificationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: { id: string } }>();
    const userId = request.user?.id;
    if (!userId) {
      return false;
    }

    if (!this.verificationService.isKycEnforcementEnabled()) {
      throw new ServiceUnavailableException({
        code: 'KYC_NOT_CONFIGURED',
        message: 'ID verification for events is not configured on this server',
      });
    }

    const passed = await this.verificationService.hasPassedIdVerification(userId);
    if (!passed) {
      throw new ForbiddenException({
        code: 'ID_VERIFICATION_REQUIRED',
        message: 'Complete ID verification to host events',
      });
    }

    return true;
  }
}
