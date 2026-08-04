import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class VerifyNinDto {
  @ApiProperty({
    example: '70123456789',
    minLength: 11,
    maxLength: 11,
    description:
      '11-digit National Identification Number. In the Dojah sandbox, use 70123456789.',
  })
  @IsString()
  @Length(11, 11)
  @Matches(/^\d{11}$/, { message: 'NIN must be exactly 11 digits.' })
  ninNumber: string;
}

