import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, IsString, IsOptional } from 'class-validator';

export class WithdrawDto {
  @ApiProperty({ example: 5000, minimum: 100, description: 'Amount in Naira' })
  @IsNumber()
  @Min(100)
  amount: number;

  @ApiProperty({ required: false, example: 'Bank account details' })
  @IsOptional()
  @IsString()
  bankDetails?: string;
}

