import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@pingme/db';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/devices.dto';

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register push notification token' })
  register(@CurrentUser() user: User, @Body() dto: RegisterDeviceDto) {
    return this.devicesService.register(user.id, dto);
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
