import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class RequestWithdrawalDto {
  @ApiProperty({ example: 5000, minimum: 100, description: 'Amount in Naira' })
  @IsNumber()
  @Min(100)
  amount: number;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Saved bank account ID to receive the withdrawal',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  bankId: string;
}
