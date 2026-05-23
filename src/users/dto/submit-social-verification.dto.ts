import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { SocialPlatform } from './link-social.dto';

export class SubmitSocialVerificationDto {
  @ApiProperty({ enum: SocialPlatform, example: SocialPlatform.INSTAGRAM })
  @IsEnum(SocialPlatform)
  platform: SocialPlatform;

  @ApiProperty({
    example: 'LV-A3K9M2X7',
    description:
      'Your personal account verification code (from signup or GET /users/social-verification/instructions). Same code for every platform.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  submittedCode: string;
}
