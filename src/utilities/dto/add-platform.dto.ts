import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class AddPlatformDto {
  @ApiProperty({ example: 'Instagram', description: 'Platform name' })
  @IsString()
  name: string;

  @ApiProperty({ required: false, example: 'https://example.com/icons/instagram.png', description: 'Platform icon URL or base64 encoded image' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ required: false, example: 0, description: 'Display order (lower numbers appear first)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

