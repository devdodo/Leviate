import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Allowed proof kinds stored inside each proofs[] item (JSON). */
export enum SubmissionProofType {
  SCREENSHOT = 'SCREENSHOT',
  LINK = 'LINK',
}

export class SubmissionProofItemDto {
  @ApiProperty({ enum: SubmissionProofType, example: SubmissionProofType.SCREENSHOT })
  @IsEnum(SubmissionProofType)
  proofType: SubmissionProofType;

  @ApiProperty({
    example: 'https://example.com/screenshot.png',
    description: 'URL to screenshot or link',
  })
  @IsString()
  proofUrl: string;
}

export class CreateSubmissionDto {
  @ApiProperty({ example: 'task-id-here' })
  @IsString()
  taskId: string;

  @ApiProperty({ example: 'application-id-here' })
  @IsString()
  applicationId: string;

  @ApiProperty({
    type: [SubmissionProofItemDto],
    description: 'One or more proof attachments for this submission',
    example: [
      {
        proofType: SubmissionProofType.SCREENSHOT,
        proofUrl: 'https://example.com/screenshot.png',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmissionProofItemDto)
  proof: SubmissionProofItemDto[];

  @ApiProperty({ required: false, example: 'Task completed as per requirements' })
  @IsOptional()
  @IsString()
  notes?: string;
}
