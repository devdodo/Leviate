import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsIn, IsOptional } from 'class-validator';
import { UserType } from '@prisma/client';

/** Public signup only — staff use admin seed / create-admin. */
const SIGNUP_USER_TYPES = [UserType.CREATOR, UserType.CONTRIBUTOR] as const;

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
    enum: SIGNUP_USER_TYPES,
    example: UserType.CREATOR,
    description: 'User type: CREATOR (posts tasks) or CONTRIBUTOR (completes tasks)',
  })
  @IsIn(SIGNUP_USER_TYPES)
  userType: (typeof SIGNUP_USER_TYPES)[number];

  @ApiProperty({
    example: 'ABC12345',
    description: 'Optional referral code from an existing user',
    required: false,
  })
  @IsOptional()
  @IsString()
  referralCode?: string;
}

