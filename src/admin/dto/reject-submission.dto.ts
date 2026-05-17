import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectSubmissionDto {
  @ApiProperty({ example: 'Screenshot does not show the required hashtag.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  comment: string;
}
