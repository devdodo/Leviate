import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, IsNotEmpty } from 'class-validator';

export class VerifyWithdrawalOtpDto {
  @ApiProperty({
    example: '123456',
    minLength: 6,
    maxLength: 6,
    description:
      'OTP from request-otp (amount and bank are taken from that request)',
  })
  @IsString()
  @Length(6, 6)
  @IsNotEmpty()
  otp: string;
}

