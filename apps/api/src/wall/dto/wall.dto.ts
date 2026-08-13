import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateWallPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;
}

export class CreateWallReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  content!: string;
}
