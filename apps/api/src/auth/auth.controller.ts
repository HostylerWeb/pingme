import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ForgotPasswordSchema,
  LoginSchema,
  SignUpSchema,
  ResetPasswordSchema,
  SignUpInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyOtpSchema,
  VerifyOtpInput,
} from '@pingme/shared';
import { Request } from 'express';
import { User } from '@pingme/db';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { getRequestMeta } from '../common/utils/crypto.util';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create account' })
  register(@Body(new ZodValidationPipe(SignUpSchema)) dto: SignUpInput, @Req() req: Request) {
    return this.authService.register(dto, getRequestMeta(req));
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login' })
  login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginInput, @Req() req: Request) {
    return this.authService.login(dto, getRequestMeta(req));
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh tokens' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, getRequestMeta(req));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Logout' })
  logout(
    @CurrentUser() user: User,
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
  ) {
    return this.authService.logout(user.id, body.refreshToken, getRequestMeta(req));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('verify-email/send')
  @ApiOperation({ summary: 'Send email verification code' })
  sendEmailOtp(@CurrentUser() user: User) {
    return this.authService.sendEmailOtp(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email with OTP' })
  verifyEmail(@CurrentUser() user: User, @Body(new ZodValidationPipe(VerifyOtpSchema)) dto: VerifyOtpInput) {
    return this.authService.verifyEmail(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('verify-phone/send')
  @ApiOperation({ summary: 'Send phone verification code' })
  sendPhoneOtp(@CurrentUser() user: User) {
    return this.authService.sendPhoneOtp(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('verify-phone')
  @ApiOperation({ summary: 'Verify phone with OTP' })
  verifyPhone(@CurrentUser() user: User, @Body(new ZodValidationPipe(VerifyOtpSchema)) dto: VerifyOtpInput) {
    return this.authService.verifyPhone(user.id, dto);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset' })
  forgotPassword(@Body(new ZodValidationPipe(ForgotPasswordSchema)) dto: ForgotPasswordInput) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  resetPassword(@Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPasswordInput) {
    return this.authService.resetPassword(dto);
  }
}
