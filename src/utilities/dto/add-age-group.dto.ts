import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class AddAgeGroupDto {
  @ApiProperty({ example: '18-24', description: 'Age group label (e.g., "13-17", "18-24", "55+")' })
  @IsString()
  label: string;

  @ApiProperty({ required: false, example: 18, description: 'Minimum age (optional, for sorting)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minAge?: number;

  @ApiProperty({ required: false, example: 24, description: 'Maximum age (optional, for sorting)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  maxAge?: number;

  @ApiProperty({ required: false, example: 0, description: 'Display order (lower numbers appear first)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

