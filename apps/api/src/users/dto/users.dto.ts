import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AvatarType } from '@pingme/db';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @IsOptional()
  @IsEnum(AvatarType)
  avatarType?: AvatarType;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;
}

export class UpdateSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  radiusMeters?: number;

  @IsOptional()
  @IsBoolean()
  quietMode?: boolean;

  @IsOptional()
  @IsBoolean()
  showDistanceBucket?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPushReplies?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPushChat?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPushIcebreaker?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPushIcebreakerNearby?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  language?: string;
}

export class MediaPresignDto {
  @IsString()
  contentType!: string;

  @IsString()
  fileName!: string;
}

export class MediaConfirmDto {
  @IsString()
  key!: string;
}
