import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UploadFileDto {
  @ApiPropertyOptional({
    example: 'submissions',
    description:
      'Optional subfolder inside your user folder. Letters, numbers, dot, dash, underscore and "/" only.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9._\-/]+$/, {
    message:
      'folder may only contain letters, numbers, dot, dash, underscore and "/"',
  })
  folder?: string;
}
