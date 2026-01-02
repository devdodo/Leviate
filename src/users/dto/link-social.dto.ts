import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional } from 'class-validator';

export enum SocialPlatform {
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin',
  INSTAGRAM = 'instagram',
  TIKTOK = 'tiktok',
  SNAPCHAT = 'snapchat',
  FACEBOOK = 'facebook',
}

export class LinkSocialDto {
  @ApiProperty({ enum: SocialPlatform, example: SocialPlatform.TWITTER })
  @IsEnum(SocialPlatform)
  platform: SocialPlatform;

  @ApiProperty({ example: '@johndoe' })
  @IsString()
  handle: string;

  @ApiProperty({ required: false, example: 'https://twitter.com/johndoe' })
  @IsOptional()
  @IsString()
  profileUrl?: string;
}

