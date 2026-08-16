import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ConfirmCheckoutDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  sessionId!: string;
}
