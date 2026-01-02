import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsObject, IsArray } from 'class-validator';

export class OnboardingDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 25, minimum: 13, maximum: 120 })
  @IsInt()
  @Min(13)
  @Max(120)
  age: number;

  @ApiProperty({ example: ['Gaming', 'Technology', 'Music'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hobbiesInterests?: string[];

  @ApiProperty({ example: 'Employed', required: false })
  @IsOptional()
  @IsString()
  employmentStatus?: string;

  @ApiProperty({ example: 'Lagos', required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: 'Ikeja', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({
    required: false,
    example: {
      twitter: '@johndoe',
      linkedin: 'john-doe',
      instagram: '@johndoe',
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

