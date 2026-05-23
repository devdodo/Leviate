import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewSocialVerificationDto {
  @ApiProperty({
    required: false,
    example: 'Code visible in bio; handle matches profile.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class RejectSocialVerificationDto {
  @ApiProperty({
    example: 'Verification code not found in public bio.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  comment: string;
}
