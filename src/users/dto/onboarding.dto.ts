import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  Min,
  Max,
  IsObject,
  IsArray,
} from 'class-validator';
import { USER_GENDERS, UserGender } from '../../common/constants/gender';

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

  @ApiProperty({
    required: false,
    enum: USER_GENDERS,
    example: 'FEMALE',
    description:
      'Used to match the contributor against gender-targeted tasks. PREFER_NOT_TO_SAY matches only tasks open to all genders, same as leaving it unset.',
  })
  @IsOptional()
  @IsIn(USER_GENDERS)
  gender?: UserGender;

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

