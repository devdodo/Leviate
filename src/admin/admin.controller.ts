import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminUserQueryDto, AdminTaskQueryDto } from './dto/admin-query.dto';
import { BaseResponseDto } from '../common/dto/base-response.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UserRole } from '@prisma/client';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    type: BaseResponseDto,
  })
  async getUsers(@Query() query: AdminUserQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user details (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User details retrieved successfully',
    type: BaseResponseDto,
  })
  async getUserDetails(@Param('id') id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Put('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend user (Admin only, SUPERADMIN required for ADMIN users)' })
  @ApiResponse({
    status: 200,
    description: 'User suspended successfully',
    type: BaseResponseDto,
  })
  async suspendUser(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.adminService.suspendUser(user.id, id, body.reason, user.role);
  }

  @Put('users/:id/unsuspend')
  @ApiOperation({ summary: 'Unsuspend user (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User unsuspended successfully',
    type: BaseResponseDto,
  })
  async unsuspendUser(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.adminService.unsuspendUser(user.id, id);
  }

  @Get('tasks')
  @ApiOperation({ summary: 'List all tasks (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Tasks retrieved successfully',
    type: BaseResponseDto,
  })
  async getTasks(@Query() query: AdminTaskQueryDto) {
    return this.adminService.getTasks(query);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get system statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: BaseResponseDto,
  })
  async getStatistics() {
    return this.adminService.getStatistics();
  }

  @Get('audit-log')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Get audit log (SuperAdmin only)' })
  @ApiResponse({
    status: 200,
    description: 'Audit log retrieved successfully',
    type: BaseResponseDto,
  })
  async getAuditLog(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAuditLog(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Post('create-admin')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Create new admin or superadmin (SuperAdmin only)' })
  @ApiResponse({
    status: 201,
    description: 'Admin created successfully',
    type: BaseResponseDto,
  })
  async createAdmin(
    @CurrentUser() user: any,
    @Body() createAdminDto: CreateAdminDto,
  ) {
    return this.adminService.createAdmin(user.id, createAdminDto);
  }

  @Get('admins')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'List all admins (SuperAdmin only)' })
  @ApiResponse({
    status: 200,
    description: 'Admins retrieved successfully',
    type: BaseResponseDto,
  })
  async getAdmins() {
    return this.adminService.getAdmins();
  }
}

