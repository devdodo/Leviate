import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { SocialVerificationStatus } from '@prisma/client';

export class ListSocialVerificationsQueryDto {
  @ApiProperty({
    required: false,
    enum: SocialVerificationStatus,
    default: SocialVerificationStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(SocialVerificationStatus)
  status?: SocialVerificationStatus;

  @ApiProperty({ required: false, example: 'instagram' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
