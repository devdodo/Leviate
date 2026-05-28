import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { DisputeStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CampaignDisputeQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: DisputeStatus })
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;
}
