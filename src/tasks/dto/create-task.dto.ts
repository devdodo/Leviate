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
import { ScheduleType, TaskStatus } from '@prisma/client';

export class TargetingDto {
  @ApiProperty({ required: false, example: 'Lagos, Nigeria' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false, example: 'English' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({ required: false, example: ['Technology', 'Gaming'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiProperty({ required: false, example: { min: 18, max: 35 } })
  @IsOptional()
  @IsObject()
  ageGroup?: { min: number; max: number };

  @ApiProperty({ required: false, example: 'All' })
  @IsOptional()
  @IsString()
  gender?: string;
}

export class CreateTaskDto {
  @ApiProperty({ example: 'Create Instagram Post for Product Launch' })
  @IsString()
  title: string;

  @ApiProperty({ required: false, example: 'Create engaging Instagram post for new product' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: ['instagram', 'twitter'], description: 'Platforms for the task' })
  @IsArray()
  @IsString({ each: true })
  platforms: string[];

  @ApiProperty({
    example: ['create_post', 'follow_account'],
    description: 'Goals: create_post, apollos_package, follow_account, comment',
  })
  @IsArray()
  @IsString({ each: true })
  goals: string[];

  @ApiProperty({ required: false, example: 'image' })
  @IsOptional()
  @IsString()
  postType?: string;

  @ApiProperty({ required: false, example: 'https://example.com/resource' })
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

  @ApiProperty({ example: '2024-01-01T10:00:00Z' })
  @IsDateString()
  scheduleStart: string;

  @ApiProperty({ required: false, example: '2024-01-01T18:00:00Z' })
  @IsOptional()
  @IsDateString()
  scheduleEnd?: string;

  @ApiProperty({ required: false, example: 'Use engaging visuals and include product benefits' })
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

  @ApiProperty({ example: 2000, minimum: 1, description: 'Budget per task in Naira' })
  @IsNumber()
  @Min(1)
  budgetPerTask: number;

  @ApiProperty({ example: 50000, minimum: 1, description: 'Total budget in Naira' })
  @IsNumber()
  @Min(1)
  totalBudget: number;

  @ApiProperty({ required: false, default: false, description: 'Save as draft' })
  @IsOptional()
  @IsString()
  saveAsDraft?: string;
}

