import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class VerifyPaymentDto {
  @ApiPropertyOptional({
    description: 'Paystack transaction reference from callback or SDK',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    description: 'Paystack callback alias for reference (trxref query param)',
  })
  @IsOptional()
  @IsString()
  trxref?: string;

  @ApiPropertyOptional({
    description: 'Task ID — used to load stored paymentReference when callback ref is missing or stale',
  })
  @IsOptional()
  @IsUUID()
  taskId?: string;
}
