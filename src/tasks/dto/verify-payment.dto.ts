import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @ApiProperty({
    description: 'Paystack transaction reference from checkout callback or initiate-payment response',
    example: 'TASK_1779993187014_f56fc853',
  })
  @IsString()
  @IsNotEmpty()
  reference: string;
}
