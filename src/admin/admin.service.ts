import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { AdminUserQueryDto, AdminTaskQueryDto } from './dto/admin-query.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UserStatus, AdminActionType, UserRole } from '@prisma/client';

// Type guard to ensure SUPERADMIN is recognized
const SUPERADMIN_ROLE = 'SUPERADMIN' as UserRole;
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getUsers(query: AdminUserQueryDto) {
    const {
      page = 1,
      limit = 10,
      status,
      userType,
      search,
    } = query;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) where.status = status;
    if (userType) where.userType = userType;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        {
          profile: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          profile: true,
          _count: {
            select: {
              createdTasks: true,
              taskApplications: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      message: 'Users retrieved successfully',
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  async getUserDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        createdTasks: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        taskApplications: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        walletTransactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'User details retrieved successfully',
      data: user,
    };
  }

  async suspendUser(adminId: string, userId: string, reason?: string, requesterRole?: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Only SUPERADMIN can suspend ADMIN users
    if (user.role === UserRole.ADMIN && requesterRole !== SUPERADMIN_ROLE) {
      throw new ForbiddenException('Only SUPERADMIN can suspend ADMIN users');
    }

    if (user.role === SUPERADMIN_ROLE) {
      throw new ForbiddenException('Cannot suspend SUPERADMIN users');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.SUSPENDED },
    });

    await this.prisma.adminAction.create({
      data: {
        adminId,
        actionType: AdminActionType.SUSPEND_USER,
        targetUserId: userId,
        reason,
      },
    });

    return {
      message: 'User suspended successfully',
      data: { userId, status: UserStatus.SUSPENDED },
    };
  }

  async unsuspendUser(adminId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });

    await this.prisma.adminAction.create({
      data: {
        adminId,
        actionType: AdminActionType.UNSUSPEND_USER,
        targetUserId: userId,
      },
    });

    return {
      message: 'User unsuspended successfully',
      data: { userId, status: UserStatus.ACTIVE },
    };
  }

  async getTasks(query: AdminTaskQueryDto) {
    const { page = 1, limit = 10, status, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          _count: {
            select: {
              applications: true,
              submissions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      message: 'Tasks retrieved successfully',
      data: {
        tasks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  async getStatistics() {
    const [
      totalUsers,
      activeUsers,
      totalTasks,
      activeTasks,
      totalTransactions,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.task.count(),
      this.prisma.task.count({ where: { status: 'ACTIVE' } }),
      this.prisma.walletTransaction.count({
        where: { status: 'COMPLETED' },
      }),
      this.prisma.walletTransaction.aggregate({
        where: {
          transactionCategory: 'PLATFORM_FEE',
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    return {
      message: 'Statistics retrieved successfully',
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
        },
        tasks: {
          total: totalTasks,
          active: activeTasks,
        },
        transactions: {
          total: totalTransactions,
        },
        revenue: {
          total: totalRevenue._sum.amount?.toString() || '0',
        },
      },
    };
  }

  async getAuditLog(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [actions, total] = await Promise.all([
      this.prisma.adminAction.findMany({
        skip,
        take: limit,
        include: {
          admin: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminAction.count(),
    ]);

    return {
      message: 'Audit log retrieved successfully',
      data: {
        actions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  async createAdmin(superAdminId: string, createAdminDto: CreateAdminDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createAdminDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(createAdminDto.password, 12);

    // Generate unique referral code
    const referralCode = this.generateReferralCode();

    // Create admin user
    const admin = await this.prisma.user.create({
      data: {
        email: createAdminDto.email,
        passwordHash,
        role: createAdminDto.role,
        userType: createAdminDto.userType || 'CREATOR',
        emailVerified: true, // Admins don't need email verification
        profileComplete: true, // Admins are considered complete
        referralCode,
        reputationScore: 100, // Admins start with max reputation
      },
      select: {
        id: true,
        email: true,
        role: true,
        userType: true,
        createdAt: true,
      },
    });

    // Log admin creation action
    await this.prisma.adminAction.create({
      data: {
        adminId: superAdminId,
        actionType: AdminActionType.OVERRIDE_VERIFICATION, // Using existing type for now
        targetUserId: admin.id,
        reason: `Created ${createAdminDto.role} account`,
      },
    });

    return {
      message: `${createAdminDto.role} created successfully`,
      data: admin,
    };
  }

  async getAdmins() {
    const admins = await this.prisma.user.findMany({
      where: {
        role: {
          in: [UserRole.ADMIN, SUPERADMIN_ROLE],
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        userType: true,
        status: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Admins retrieved successfully',
      data: admins,
    };
  }

  private generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}

