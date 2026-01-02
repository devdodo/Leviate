import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { UserType } from '@prisma/client';

export class SignupDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    minLength: 8,
    description: 'Password (minimum 8 characters)',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    enum: UserType,
    example: UserType.CREATOR,
    description: 'User type: CREATOR (posts tasks) or CONTRIBUTOR (completes tasks)',
  })
  @IsEnum(UserType)
  userType: UserType;

  @ApiProperty({
    example: 'ABC12345',
    description: 'Optional referral code from an existing user',
    required: false,
  })
  @IsOptional()
  @IsString()
  referralCode?: string;
}

