import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MatchRequestInput, MatchRequestSchema } from '@pingme/shared';
import { User } from '@pingme/db';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerifiedGuard } from '../verification/guards/verified.guard';
import { MatchesService } from './matches.service';

@ApiTags('matches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @ApiOperation({ summary: 'List pending and active matches' })
  list(@CurrentUser() user: User) {
    return this.matchesService.list(user.id);
  }

  @Post('request')
  @UseGuards(VerifiedGuard)
  @ApiOperation({ summary: 'Request chat from wall reply' })
  request(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(MatchRequestSchema)) dto: MatchRequestInput,
  ) {
    return this.matchesService.request(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get match detail' })
  get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.matchesService.getById(user.id, id);
  }

  @Post(':id/accept')
  @UseGuards(VerifiedGuard)
  @ApiOperation({ summary: 'Accept match' })
  accept(@CurrentUser() user: User, @Param('id') id: string) {
    return this.matchesService.accept(user.id, id);
  }

  @Post(':id/decline')
  @ApiOperation({ summary: 'Decline match' })
  decline(@CurrentUser() user: User, @Param('id') id: string) {
    return this.matchesService.decline(user.id, id);
  }
}
