import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@pingme/db';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerifiedGuard } from '../verification/guards/verified.guard';
import {
  AcknowledgeIcebreakerUnansweredDto,
  IcebreakerInterestDto,
  StartIcebreakerDto,
} from './dto/icebreaker.dto';
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
  start(@CurrentUser() user: User, @Body() body: StartIcebreakerDto) {
    return this.icebreakerService.start(user.id, body);
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

  @Get('nearby')
  @UseGuards(VerifiedGuard)
  @ApiOperation({ summary: 'List nearby people in break-the-ice mode' })
  nearby(@CurrentUser() user: User) {
    return this.icebreakerService.getNearby(user.id);
  }

  @Post('interest')
  @UseGuards(VerifiedGuard)
  @ApiOperation({ summary: 'Say yes or no to a nearby icebreaker user' })
  interest(@CurrentUser() user: User, @Body() body: IcebreakerInterestDto) {
    return this.icebreakerService.setInterest(user.id, body.targetUserId, body.interested);
  }

  @Post('acknowledge-unanswered')
  @ApiOperation({ summary: 'Dismiss unanswered icebreaker request notices' })
  acknowledgeUnanswered(
    @CurrentUser() user: User,
    @Body() body: AcknowledgeIcebreakerUnansweredDto,
  ) {
    return this.icebreakerService.acknowledgeUnanswered(user.id, body.interestIds);
  }
}
