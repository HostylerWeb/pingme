import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PresencePingSchema,
  SetAvailableSchema,
  PresencePingInput,
  SetAvailableInput,
} from '@pingme/shared';
import { User } from '@pingme/db';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PresenceService } from './presence.service';

@ApiTags('presence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('presence')
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Post('ping')
  @ApiOperation({ summary: 'Update location' })
  ping(@CurrentUser() user: User, @Body(new ZodValidationPipe(PresencePingSchema)) dto: PresencePingInput) {
    return this.presenceService.ping(user.id, dto);
  }

  @Post('available')
  @ApiOperation({ summary: 'Toggle Available mode' })
  setAvailable(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(SetAvailableSchema)) dto: SetAvailableInput,
  ) {
    return this.presenceService.setAvailable(user.id, dto);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get presence status' })
  status(@CurrentUser() user: User) {
    return this.presenceService.getStatus(user.id);
  }

  @Get('nearby-count')
  @ApiOperation({ summary: 'Count nearby available users' })
  nearbyCount(@CurrentUser() user: User) {
    return this.presenceService.getNearbyCount(user.id);
  }
}
