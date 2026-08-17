import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@pingme/db';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReputationService } from './reputation.service';

@ApiTags('reputation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ReputationController {
  constructor(private readonly reputation: ReputationService) {}

  @Get('users/me/reputation')
  @ApiOperation({ summary: 'Current user reputation score, tier, and recent events' })
  async getMe(@CurrentUser() user: User) {
    const data = await this.reputation.getMeReputation(user.id);
    return { success: true, data };
  }
}
