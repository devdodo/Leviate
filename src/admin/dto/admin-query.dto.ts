import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { UserStatus, UserType, TaskStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class AdminUserQueryDto extends PaginationDto {
  @ApiProperty({ required: false, enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiProperty({ required: false, enum: UserType })
  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminTaskQueryDto extends PaginationDto {
  @ApiProperty({ required: false, enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;
}

