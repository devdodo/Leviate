import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber, Min, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { TaskStatus, UserType } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class TaskQueryDto extends PaginationDto {
  @ApiProperty({ required: false, enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ required: false, example: 'instagram' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiProperty({ required: false, example: 'create_post' })
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiProperty({ required: false, example: 1000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minBudget?: number;

  @ApiProperty({ required: false, example: 10000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxBudget?: number;

  @ApiProperty({ required: false, example: 'product launch' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, example: 'budgetPerTask', enum: ['budgetPerTask', 'createdAt', 'scheduleStart'] })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({ required: false, example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

