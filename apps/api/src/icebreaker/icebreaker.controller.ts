import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@pingme/db';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerifiedGuard } from '../verification/guards/verified.guard';
import { IcebreakerService } from './icebreaker.service';

@ApiTags('icebreaker')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('icebreaker')
export class IcebreakerController {
  constructor(private readonly icebreakerService: IcebreakerService) {}

  @Post('start')
  @UseGuards(VerifiedGuard)
  @ApiOperation({ summary: 'Start break-the-ice session' })
  start(@CurrentUser() user: User) {
    return this.icebreakerService.start(user.id);
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Cancel active icebreaker session' })
  cancel(@CurrentUser() user: User) {
    return this.icebreakerService.cancel(user.id);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get icebreaker session status' })
  status(@CurrentUser() user: User) {
    return this.icebreakerService.getStatus(user.id);
  }
}
