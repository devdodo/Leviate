import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, IsNotEmpty } from 'class-validator';

export class VerifyWithdrawalOtpDto {
  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  @IsString()
  @Length(6, 6)
  @IsNotEmpty()
  otp: string;

  @ApiProperty({ example: 'bank-account-id', description: 'Bank account ID to withdraw to' })
  @IsString()
  @IsNotEmpty()
  bankAccountId: string;
}

