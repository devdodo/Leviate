import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType, TransactionCategory, TransactionStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class TransactionQueryDto extends PaginationDto {
  @ApiProperty({ required: false, enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty({ required: false, enum: TransactionCategory })
  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;

  @ApiProperty({ required: false, enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;
}

