import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsNumber,
  Min,
  IsDateString,
  IsObject,
  ValidateNested,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ScheduleType } from '@prisma/client';
// Temporary workaround: Define enums as const objects until TypeScript server refreshes
// These enums exist in the Prisma schema and will be available after migration is applied
const TaskType = {
  SINGLE: 'SINGLE',
  MULTI: 'MULTI',
} as const;
type TaskType = typeof TaskType[keyof typeof TaskType];

const TaskCategory = {
  MAKE_POST: 'MAKE_POST',
  COMMENT_POST: 'COMMENT_POST',
  LIKE_SHARE_SAVE_REPOST: 'LIKE_SHARE_SAVE_REPOST',
  FOLLOW_ACCOUNT: 'FOLLOW_ACCOUNT',
} as const;
type TaskCategory = typeof TaskCategory[keyof typeof TaskCategory];

const ContentType = {
  VIDEO: 'VIDEO',
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
} as const;
type ContentType = typeof ContentType[keyof typeof ContentType];

export class TargetingDto {
  @ApiProperty({
    required: false,
    example: '18-35, fitness enthusiasts',
    description: 'Target audience description (e.g., age range and interests)',
  })
  @IsOptional()
  @IsString()
  targetAudience?: string;

  @ApiProperty({
    required: false,
    example: ['Lagos', 'Abuja', 'Port Harcourt'],
    description: 'Array of target locations',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @ApiProperty({ required: false, example: 'English' })
  @IsOptional()
  @IsString()
  language?: string;
}

export class CreateTaskDto {
  @ApiProperty({
    enum: TaskCategory,
    example: TaskCategory.MAKE_POST,
    description:
      'Task category: MAKE_POST, COMMENT_POST, LIKE_SHARE_SAVE_REPOST, FOLLOW_ACCOUNT (from GET /tasks/task-types categories)',
  })
  @IsEnum(TaskCategory)
  category: TaskCategory;

  @ApiProperty({
    enum: TaskType,
    example: TaskType.SINGLE,
    description:
      'SINGLE (one-time) or MULTI (multiple engagements per contributor) (from GET /tasks/task-types taskTypes)',
  })
  @IsEnum(TaskType)
  taskType: TaskType;

  @ApiProperty({
    example: 'Create Instagram Post for Product Launch',
    description: 'Task title',
  })
  @IsString()
  title: string;

  @ApiProperty({
    required: false,
    example: 'Create engaging Instagram post for new product',
    description: 'Task description or notes',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 'instagram',
    description: 'Platform: instagram, twitter, facebook, youtube, tiktok, linkedin',
  })
  @IsString()
  platform: string;

  @ApiProperty({
    required: false,
    example: 'https://instagram.com/p/example',
    description:
      'Resource link (post URL, account URL). Not used for MAKE_POST — contributors submit their post link as evidence for admin verification.',
  })
  @IsOptional()
  @IsString()
  resourceLink?: string;

  @ApiProperty({
    required: false,
    enum: ContentType,
    example: ContentType.VIDEO,
    description: 'Content type: VIDEO, TEXT, or IMAGE',
  })
  @IsOptional()
  @IsEnum(ContentType)
  contentType?: ContentType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  audiencePreferences?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => TargetingDto)
  targeting?: TargetingDto;

  @ApiProperty({
    enum: ScheduleType,
    example: ScheduleType.FIXED,
    description: 'FIXED: Work within specific dates. VARIABLE: Flexible schedule across a wider timeframe.',
  })
  @IsEnum(ScheduleType)
  scheduleType: ScheduleType;

  @ApiProperty({
    example: '2024-01-01T10:00:00Z',
    description: 'Campaign start date',
  })
  @IsDateString()
  scheduleStart: string;

  @ApiProperty({
    required: false,
    example: '2024-01-01T18:00:00Z',
    description: 'Campaign end date',
  })
  @IsOptional()
  @IsDateString()
  scheduleEnd?: string;

  @ApiProperty({
    required: false,
    example: 'Use engaging visuals and include product benefits',
  })
  @IsOptional()
  @IsString()
  commentsInstructions?: string;

  @ApiProperty({ required: false, example: ['#product', '#launch'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];

  @ApiProperty({ required: false, example: ['innovative', 'premium'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  buzzwords?: string[];

  @ApiProperty({
    example: 500,
    minimum: 5,
    description: 'Budget amount in Naira',
  })
  @IsNumber()
  @Min(5)
  budget: number;
}
