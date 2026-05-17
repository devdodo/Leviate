import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class WithdrawDto {
  @ApiProperty({ example: 5000, minimum: 100, description: 'Amount in Naira' })
  @IsNumber()
  @Min(100)
  amount: number;
}

