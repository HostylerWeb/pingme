import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BlockUserInput, BlockUserSchema, CreateReportInput, CreateReportSchema } from '@pingme/shared';
import { User } from '@pingme/db';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BlocksService } from '../common/services/blocks.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerifiedGuard } from '../verification/guards/verified.guard';
import { ReportsService } from './reports.service';

@ApiTags('safety')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SafetyController {
  constructor(
    private readonly blocks: BlocksService,
    private readonly reports: ReportsService,
  ) {}

  @Post('blocks')
  @UseGuards(VerifiedGuard)
  @ApiOperation({ summary: 'Block a user' })
  block(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(BlockUserSchema)) dto: BlockUserInput,
  ) {
    return this.blocks.blockUser(user.id, dto.userId);
  }

  @Delete('blocks/:userId')
  @ApiOperation({ summary: 'Unblock a user' })
  unblock(@CurrentUser() user: User, @Param('userId') blockedUserId: string) {
    return this.blocks.unblockUser(user.id, blockedUserId);
  }

  @Get('blocks')
  @ApiOperation({ summary: 'List blocked users' })
  listBlocks(@CurrentUser() user: User) {
    return this.blocks.listBlockedUsers(user.id);
  }

  @Post('reports')
  @UseGuards(VerifiedGuard)
  @ApiOperation({ summary: 'Submit a report' })
  report(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(CreateReportSchema)) dto: CreateReportInput,
  ) {
    return this.reports.create(user.id, dto);
  }
}
