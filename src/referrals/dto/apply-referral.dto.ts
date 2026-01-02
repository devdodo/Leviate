import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ApplyReferralDto {
  @ApiProperty({ example: 'ABC123' })
  @IsString()
  referralCode: string;
}

