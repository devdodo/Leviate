import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, IsIn, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

const STAFF_ROLES = [UserRole.ADMIN, UserRole.SUPERADMIN] as const;

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
    description:
      'Staff role: ADMIN (approve/reject submissions) or SUPERADMIN (same + manage admins)',
    enum: STAFF_ROLES,
  })
  @IsIn(STAFF_ROLES)
  @IsNotEmpty()
  role: (typeof STAFF_ROLES)[number];
}
