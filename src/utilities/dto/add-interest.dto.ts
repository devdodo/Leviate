import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class AddInterestDto {
  @ApiProperty({ example: 'Technology', description: 'Interest name' })
  @IsString()
  name: string;

  @ApiProperty({ required: false, example: 0, description: 'Display order (lower numbers appear first)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

