import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, IsNotEmpty, IsUUID } from 'class-validator';

export class VerifyWithdrawalOtpDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'withdrawalRequestId returned from POST /banks/withdrawal/request-otp',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  withdrawalRequestId: string;

  @ApiProperty({
    example: '123456',
    minLength: 6,
    maxLength: 6,
    description: 'OTP code returned from request-otp',
  })
  @IsString()
  @Length(6, 6)
  @IsNotEmpty()
  otp: string;
}

