import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class AddGenderDto {
  @ApiProperty({ example: 'All', description: 'Gender label (e.g., "All", "Male", "Female", "Other")' })
  @IsString()
  label: string;

  @ApiProperty({ required: false, example: 0, description: 'Display order (lower numbers appear first)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

