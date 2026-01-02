import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyNinDto {
  @ApiProperty({ example: '12345678901', minLength: 11, maxLength: 11 })
  @IsString()
  @Length(11, 11)
  ninNumber: string;
}

