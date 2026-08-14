import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RegisterDeviceSchema, RegisterDeviceInput } from '@pingme/shared';
import { User } from '@pingme/db';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { getRequestMeta } from '../common/utils/crypto.util';
import { DevicesService } from './devices.service';

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register push notification token' })
  register(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(RegisterDeviceSchema)) dto: RegisterDeviceInput,
    @Req() req: Request,
  ) {
    return this.devicesService.register(user.id, dto, getRequestMeta(req));
  }

  @Get()
  @ApiOperation({ summary: 'List registered devices' })
  list(@CurrentUser() user: User) {
    return this.devicesService.list(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Unregister device' })
  remove(@CurrentUser() user: User, @Param('id') deviceId: string) {
    return this.devicesService.remove(user.id, deviceId);
  }
}
