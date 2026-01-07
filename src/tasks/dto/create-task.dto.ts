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
} from 'class-validator';
import { Type } from 'class-transformer';
import { ScheduleType, TaskType, TaskCategory, ContentType } from '@prisma/client';

export class TargetingDto {
  @ApiProperty({
    required: false,
    example: ['Tech', 'Fashion', 'Music'],
    description: 'Array of interest tags',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiProperty({
    required: false,
    example: ['18-24', '25-34'],
    description: 'Age group ranges: 13-17, 18-24, 25-34, 35-44, 45-54, 55+',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ageGroup?: string[];

  @ApiProperty({
    required: false,
    example: 'All',
    enum: ['All', 'Male', 'Female', 'Other'],
    description: 'Gender targeting',
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ required: false, example: 'Lagos, Nigeria' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false, example: 'English' })
  @IsOptional()
  @IsString()
  language?: string;
}

export class CreateTaskDto {
  @ApiProperty({
    enum: TaskType,
    example: TaskType.SINGLE,
    description: 'Task type: SINGLE (one-time) or MULTI (multiple engagements)',
  })
  @IsEnum(TaskType)
  taskType: TaskType;

  @ApiProperty({
    enum: TaskCategory,
    example: TaskCategory.MAKE_POST,
    description: 'Task category: MAKE_POST, COMMENT_POST, LIKE_SHARE_SAVE_REPOST, FOLLOW_ACCOUNT',
  })
  @IsEnum(TaskCategory)
  category: TaskCategory;

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
    example: ['instagram', 'twitter', 'facebook'],
    description: 'Platforms: instagram, twitter, facebook, youtube, tiktok, linkedin',
  })
  @IsArray()
  @IsString({ each: true })
  platforms: string[];

  @ApiProperty({
    required: false,
    enum: ContentType,
    example: ContentType.VIDEO,
    description: 'Content type: VIDEO, TEXT, or IMAGE',
  })
  @IsOptional()
  @IsEnum(ContentType)
  contentType?: ContentType;

  @ApiProperty({
    required: false,
    example: 'https://example.com/post/123',
    description: 'Link or Sample Post (optional)',
  })
  @IsOptional()
  @IsString()
  resourceLink?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  audiencePreferences?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => TargetingDto)
  targeting?: TargetingDto;

  @ApiProperty({ enum: ScheduleType, example: ScheduleType.FIXED })
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

  @ApiProperty({
    required: false,
    default: false,
    description: 'Save as draft',
  })
  @IsOptional()
  @IsString()
  saveAsDraft?: string;
}
