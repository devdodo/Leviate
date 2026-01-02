import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, IsNotEmpty } from 'class-validator';

export class AddBankDto {
  @ApiProperty({ example: '0123456789', minLength: 10, maxLength: 10 })
  @IsString()
  @Length(10, 10)
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({ example: '058', description: 'Bank code from Paystack' })
  @IsString()
  @IsNotEmpty()
  bankCode: string;
}

