import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

const TaskCategory = {
  MAKE_POST: 'MAKE_POST',
  COMMENT_POST: 'COMMENT_POST',
  LIKE_SHARE_SAVE_REPOST: 'LIKE_SHARE_SAVE_REPOST',
  FOLLOW_ACCOUNT: 'FOLLOW_ACCOUNT',
} as const;
type TaskCategory = (typeof TaskCategory)[keyof typeof TaskCategory];

const ContentType = {
  VIDEO: 'VIDEO',
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
} as const;
type ContentType = (typeof ContentType)[keyof typeof ContentType];

export class EstimateTaskPricingDto {
  @ApiProperty({ enum: TaskCategory, example: TaskCategory.MAKE_POST })
  @IsEnum(TaskCategory)
  category: TaskCategory;

  @ApiPropertyOptional({ enum: ContentType, example: ContentType.VIDEO })
  @IsOptional()
  @IsEnum(ContentType)
  contentType?: ContentType;

  @ApiPropertyOptional({
    example: 10,
    description: 'Planned contributors. If omitted, derived from budget ÷ unit rate.',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  contributorCount?: number;

  @ApiPropertyOptional({
    example: 80000,
    description: 'Campaign budget in Naira. Used to derive contributor count when count is omitted.',
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  budget?: number;
}
