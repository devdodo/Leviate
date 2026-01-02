import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ProofType } from '@prisma/client';

export class CreateSubmissionDto {
  @ApiProperty({ example: 'task-id-here' })
  @IsString()
  taskId: string;

  @ApiProperty({ example: 'application-id-here' })
  @IsString()
  applicationId: string;

  @ApiProperty({ enum: ProofType, example: ProofType.SCREENSHOT })
  @IsEnum(ProofType)
  proofType: ProofType;

  @ApiProperty({
    example: 'https://example.com/screenshot.png',
    description: 'URL to screenshot or link',
  })
  @IsString()
  proofUrl: string;

  @ApiProperty({ required: false, example: 'Task completed as per requirements' })
  @IsOptional()
  @IsString()
  notes?: string;
}

