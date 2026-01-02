import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, IsEnum, MinLength } from 'class-validator';
import { UserRole, UserType } from '@prisma/client';

export class CreateAdminDto {
  @ApiProperty({ example: 'admin@leviateapp.com', description: 'Admin email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecurePassword123!', description: 'Admin password (min 8 characters)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({ 
    example: 'ADMIN', 
    description: 'Admin role (ADMIN or SUPERADMIN)',
    enum: UserRole
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @ApiProperty({ 
    example: 'CREATOR', 
    description: 'User type (CREATOR or CONTRIBUTOR)',
    enum: ['CREATOR', 'CONTRIBUTOR'],
    required: false
  })
  @IsEnum(['CREATOR', 'CONTRIBUTOR'])
  userType?: UserType;
}

