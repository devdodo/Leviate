import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCampaignDisputeDto {
  @ApiProperty({
    example: 'Contributors submitted off-brief content and payouts were disputed.',
  })
  @IsString()
  @MaxLength(2000)
  reason: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://example.com/evidence/1.png'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  evidence?: string[];
}
