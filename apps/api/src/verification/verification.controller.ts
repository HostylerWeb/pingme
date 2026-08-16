import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@pingme/db';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DiditWebhookPayload } from './didit.service';
import { VerificationService } from './verification.service';

@ApiTags('verification')
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('start')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start Didit liveness verification session' })
  start(@CurrentUser() user: User) {
    return this.verificationService.start(user.id, user.email);
  }

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user liveness verification status' })
  status(@CurrentUser() user: User) {
    return this.verificationService.getStatus(user.id);
  }

  @Post('start-kyc')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start Didit full ID KYC session (for event hosting)' })
  startKyc(@CurrentUser() user: User) {
    return this.verificationService.startKyc(user.id, user.email);
  }

  @Post('webhook')
  @Public()
  @ApiOperation({ summary: 'Didit webhook (signature verified)' })
  webhook(
    @Body() body: DiditWebhookPayload,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.verificationService.handleWebhook(body, headers);
  }

  @Get('callback')
  @Public()
  @ApiOperation({ summary: 'Browser callback after Didit hosted flow (optional)' })
  callback(@Req() _req: Request) {
    return {
      success: true,
      message: 'Verification complete. Return to the PingMe app.',
    };
  }
}
