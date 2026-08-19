import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsNumber,
  Min,
  IsDateString,
  IsObject,
  IsIn,
  ValidateNested,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ScheduleType } from '@prisma/client';
import { TARGET_GENDERS, TargetGender } from '../../common/constants/gender';
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

  @ApiProperty({
    required: false,
    enum: TARGET_GENDERS,
    example: 'ALL',
    description:
      'Optional gender filter for contributors (from GET /tasks/task-types targetGenders). ' +
      'Omitting it, or sending ALL, opens the task to every contributor. A specific gender ' +
      'never matches contributors who chose PREFER_NOT_TO_SAY or have not set one.',
  })
  @IsOptional()
  @IsIn(TARGET_GENDERS)
  gender?: TargetGender;

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
      'Reference link the contributor works from — the post to engage with, the account to follow, or for MAKE_POST the sound/post to riff on. Applies to every category. Distinct from the link a contributor submits as evidence of completed work.',
  })
  @IsOptional()
  @IsString()
  resourceLink?: string;

  @ApiProperty({
    required: false,
    enum: ContentType,
    example: ContentType.VIDEO,
    description:
      'Content type: VIDEO, TEXT, or IMAGE. Adds the content type amount from GET /tasks/task-types to the category rate per contributor.',
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

  @ApiPropertyOptional({
    example: 262150,
    minimum: 5,
    description:
      'OPTIONAL — omit it and the server calculates the budget from category, ' +
      'contentType and contributorCount, which is the recommended flow. ' +
      'If you do send it, it must match to within 1 Naira or the request is ' +
      'rejected, since this is the amount the creator is charged. ' +
      'unitRate = category rate (+ content type rate for MAKE_POST only); ' +
      'payoutPool = unitRate × contributorCount, paid to contributors in full; ' +
      'budget = payoutPool + the platform fee charged to the creator. ' +
      'POST /tasks/pricing/estimate returns the exact figure as totalBudget.',
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  budget?: number;

  @ApiProperty({
    example: 10,
    minimum: 1,
    description:
      'Required number of contributors the campaign covers, and the main driver of price. ' +
      'Each verified contributor is paid the full locked rate (payoutPool ÷ contributorCount) ' +
      'with nothing deducted — the platform fee is charged to the creator on top. ' +
      'The pool is divided by this number, not by how many contributors actually work.',
  })
  @IsNumber()
  @Min(1)
  contributorCount: number;
}
