import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsObject,
  IsArray,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    required: false,
    example: ['Gaming', 'Technology', 'Music'],
    type: [String],
    description:
      'Can be set on first save, then only once every 30 days. Use onboarding for initial profile setup.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hobbiesInterests?: string[];

  @ApiProperty({ required: false, example: 'Employed' })
  @IsOptional()
  @IsString()
  employmentStatus?: string;

  @ApiProperty({ required: false, example: 'Lagos' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ required: false, example: 'Ikeja' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({
    required: false,
    example: {
      twitter: '@johndoe',
      linkedin: 'john-doe',
      instagram: '@johndoe',
      tiktok: '@johndoe',
      snapchat: 'johndoe',
      facebook: 'johndoe',
    },
    description:
      'Can be set on first save, then only once every 90 days. Use POST /users/link-social for single-platform updates (same cooldown).',
  })
  @IsOptional()
  @IsObject()
  socialMediaHandles?: {
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    tiktok?: string;
    snapchat?: string;
    facebook?: string;
  };
}
