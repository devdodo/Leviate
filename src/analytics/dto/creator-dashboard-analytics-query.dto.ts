import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum CreatorAnalyticsPeriod {
  WEEK = 'week',
  MONTH = 'month',
}

export class CreatorDashboardAnalyticsQueryDto {
  @ApiPropertyOptional({
    enum: CreatorAnalyticsPeriod,
    default: CreatorAnalyticsPeriod.WEEK,
    description:
      'week: task completions grouped Mon–Sun for the current week. month: daily buckets for the current calendar month.',
  })
  @IsOptional()
  @IsEnum(CreatorAnalyticsPeriod)
  period?: CreatorAnalyticsPeriod = CreatorAnalyticsPeriod.WEEK;
}
