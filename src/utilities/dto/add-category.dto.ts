import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class AddCategoryDto {
  @ApiProperty({ example: 'Make a Post', description: 'Category title' })
  @IsString()
  title: string;

  @ApiProperty({ required: false, example: 'Create content on the platform', description: 'Category subtitle' })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiProperty({ required: false, example: 0, description: 'Display order (lower numbers appear first)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

