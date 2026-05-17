import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveSubmissionDto {
  @ApiPropertyOptional({ example: 'Proof matches task requirements.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
