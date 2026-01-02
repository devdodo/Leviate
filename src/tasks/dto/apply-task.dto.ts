import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApplyTaskDto {
  @ApiProperty({ required: false, example: 'I have experience with social media marketing' })
  @IsOptional()
  @IsString()
  message?: string;
}

