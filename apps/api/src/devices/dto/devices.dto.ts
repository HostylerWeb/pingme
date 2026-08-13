import { DevicePlatform } from '@pingme/db';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDeviceDto {
  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @IsString()
  @MinLength(10)
  pushToken!: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;
}
