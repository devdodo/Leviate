import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/services/prisma.service';
import { EmailService } from '../common/services/email.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto'; 
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserType, ReferralStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async signup(signupDto: SignupDto) {
    const { email, password, userType, referralCode } = signupDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate referral code if provided (ignore empty strings)
    let referredById: string | undefined;
    if (referralCode && referralCode.trim() !== '') {
      const referrer = await this.prisma.user.findUnique({
        where: { referralCode: referralCode.trim() },
      });

      if (!referrer) {
        throw new BadRequestException('Invalid referral code');
      }

      referredById = referrer.id;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate verification code
    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpiresAt = new Date();
    verificationCodeExpiresAt.setMinutes(
      verificationCodeExpiresAt.getMinutes() + 15,
    );

    // Generate unique referral code for the new user
    const userReferralCode = this.generateReferralCode();

    // Create user with initial reputation score of 75
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        userType,
        verificationCode,
        verificationCodeExpiresAt,
        referralCode: userReferralCode,
        referredById,
        reputationScore: 75, // Initial reputation score
      },
      select: {
        id: true,
        email: true,
        userType: true,
        emailVerified: true,
      },
    });

    // Create referral record if referral code was provided
    if (referredById) {
      await this.prisma.referral.create({
        data: {
          referrerId: referredById,
          referredId: user.id,
          status: ReferralStatus.PENDING,
        },
      });
    }

    // Send OTP email via Zeptomail
    await this.emailService.sendOTP(email, verificationCode);

    return {
      message: 'Signup successful. Please check your email for the verification code.',
      data: {
        userId: user.id,
        email: user.email,
      },
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { email, verificationCode } = verifyEmailDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('Invalid email or verification code');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    if (
      !user.verificationCode ||
      user.verificationCode !== verificationCode
    ) {
      throw new BadRequestException('Invalid verification code');
    }

    if (
      !user.verificationCodeExpiresAt ||
      user.verificationCodeExpiresAt < new Date()
    ) {
      throw new BadRequestException('Verification code has expired');
    }

    // Update user - email verified, registration complete
    // Reputation score is already set to 75 on signup
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
      },
      select: {
        id: true,
        email: true,
        userType: true,
        reputationScore: true,
      },
    });

    // Send welcome email
    await this.emailService.sendWelcomeEmail(user.email);

    return {
      message: 'Email verified successfully. Registration complete!',
      data: {
        userId: updatedUser.id,
        email: updatedUser.email,
        userType: updatedUser.userType,
        reputationScore: updatedUser.reputationScore, // Should be 75
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'DELETED') {
      throw new UnauthorizedException('User account not found');
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('User account is suspended');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if password needs to be changed (after reset)
    const needsPasswordChange = false; // TODO: Implement password reset flag

    const payload = {
      sub: user.id,
      email: user.email,
      userType: user.userType,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'Login successful',
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          userType: user.userType,
          role: user.role,
          emailVerified: user.emailVerified,
          profileComplete: user.profileComplete,
          reputationScore: user.reputationScore,
          needsPasswordChange,
        },
      },
    };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    return {
      message: 'Password changed successfully',
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists for security
      return {
        message:
          'If an account exists with this email, a password reset link has been sent.',
      };
    }

    // Generate default password
    const defaultPassword = this.generateDefaultPassword();

    // Hash and update password
    const passwordHash = await bcrypt.hash(defaultPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        // TODO: Set flag to force password change on next login
      },
    });

    // Send default password via Zeptomail
    await this.emailService.sendPasswordReset(email, defaultPassword);

    return {
      message:
        'If an account exists with this email, a default password has been sent. Please change it after logging in.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, newPassword } = resetPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        // TODO: Clear password reset flag
      },
    });

    return {
      message: 'Password reset successfully',
    };
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private generateDefaultPassword(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}

