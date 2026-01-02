import { ApiProperty } from '@nestjs/swagger';

export class BaseResponseDto<T> {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  data: T;

  @ApiProperty({ required: false })
  meta?: any;

  @ApiProperty()
  timestamp: string;
}

export class ErrorResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  error: {
    code: string;
    details?: any;
    stack?: string;
  };

  @ApiProperty()
  timestamp: string;
}

