import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { VerificationService } from '../verification.service';

@Injectable()
export class VerifiedGuard implements CanActivate {
  constructor(private readonly verificationService: VerificationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: { id: string } }>();
    const userId = request.user?.id;
    if (!userId) {
      return false;
    }

    await this.verificationService.assertGatedAccess(userId);
    return true;
  }
}
