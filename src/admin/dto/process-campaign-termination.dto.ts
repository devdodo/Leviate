import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ProcessCampaignTerminationDto {
  @ApiProperty({ enum: ['PROCESSED', 'CANCELLED'] })
  @IsIn(['PROCESSED', 'CANCELLED'])
  status: 'PROCESSED' | 'CANCELLED';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}
