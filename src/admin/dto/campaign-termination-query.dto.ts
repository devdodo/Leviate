import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TerminationRequestStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CampaignTerminationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TerminationRequestStatus })
  @IsOptional()
  @IsEnum(TerminationRequestStatus)
  status?: TerminationRequestStatus;
}
