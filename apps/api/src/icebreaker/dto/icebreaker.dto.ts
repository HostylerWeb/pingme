import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MAX_ICEBREAKER_INTRO_LENGTH } from '@pingme/shared';

export class StartIcebreakerDto {
  @IsOptional()
  @IsBoolean()
  showPhoto?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_ICEBREAKER_INTRO_LENGTH)
  introMessage?: string;
}

export class IcebreakerInterestDto {
  @IsUUID()
  targetUserId!: string;

  @IsBoolean()
  interested!: boolean;
}
