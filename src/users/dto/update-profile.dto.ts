import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsObject } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ required: false, example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false, example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ required: false, example: 25, minimum: 13, maximum: 120 })
  @IsOptional()
  @IsInt()
  @Min(13)
  @Max(120)
  age?: number;

  @ApiProperty({ required: false, example: ['Gaming', 'Technology', 'Music'] })
  @IsOptional()
  @IsObject()
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

