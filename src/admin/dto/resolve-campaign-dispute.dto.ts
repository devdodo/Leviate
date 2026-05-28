import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveCampaignDisputeDto {
  @ApiProperty({ enum: ['RESOLVED', 'REJECTED'] })
  @IsIn(['RESOLVED', 'REJECTED'])
  status: 'RESOLVED' | 'REJECTED';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminComment?: string;
}
