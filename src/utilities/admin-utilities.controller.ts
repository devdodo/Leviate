import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UtilitiesService } from './utilities.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { BaseResponseDto } from '../common/dto/base-response.dto';
import { AddInterestDto } from './dto/add-interest.dto';
import { AddAgeGroupDto } from './dto/add-age-group.dto';
import { AddGenderDto } from './dto/add-gender.dto';
import { AddCategoryDto } from './dto/add-category.dto';
import { AddPlatformDto } from './dto/add-platform.dto';

@ApiTags('Admin Utilities')
@Controller('admin/utilities')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminUtilitiesController {
  constructor(private readonly utilitiesService: UtilitiesService) {}

  // ============================================
  // INTERESTS
  // ============================================

  @Post('interests')
  @ApiOperation({ summary: 'Add interest (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Interest added successfully',
    type: BaseResponseDto,
  })
  async addInterest(@Body() addInterestDto: AddInterestDto) {
    return this.utilitiesService.addInterest(
      addInterestDto.name,
      addInterestDto.order,
    );
  }

  @Delete('interests/:id')
  @ApiOperation({ summary: 'Remove interest (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Interest removed successfully',
    type: BaseResponseDto,
  })
  async removeInterest(@Param('id') id: string) {
    return this.utilitiesService.removeInterest(id);
  }

  // ============================================
  // AGE GROUPS
  // ============================================

  @Post('age-groups')
  @ApiOperation({ summary: 'Add age group (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Age group added successfully',
    type: BaseResponseDto,
  })
  async addAgeGroup(@Body() addAgeGroupDto: AddAgeGroupDto) {
    return this.utilitiesService.addAgeGroup(
      addAgeGroupDto.label,
      addAgeGroupDto.minAge,
      addAgeGroupDto.maxAge,
      addAgeGroupDto.order,
    );
  }

  @Delete('age-groups/:id')
  @ApiOperation({ summary: 'Remove age group (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Age group removed successfully',
    type: BaseResponseDto,
  })
  async removeAgeGroup(@Param('id') id: string) {
    return this.utilitiesService.removeAgeGroup(id);
  }

  // ============================================
  // GENDERS
  // ============================================

  @Post('genders')
  @ApiOperation({ summary: 'Add gender (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Gender added successfully',
    type: BaseResponseDto,
  })
  async addGender(@Body() addGenderDto: AddGenderDto) {
    return this.utilitiesService.addGender(
      addGenderDto.label,
      addGenderDto.order,
    );
  }

  @Delete('genders/:id')
  @ApiOperation({ summary: 'Remove gender (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Gender removed successfully',
    type: BaseResponseDto,
  })
  async removeGender(@Param('id') id: string) {
    return this.utilitiesService.removeGender(id);
  }

  // ============================================
  // CATEGORIES
  // ============================================

  @Post('categories')
  @ApiOperation({ summary: 'Add category (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Category added successfully',
    type: BaseResponseDto,
  })
  async addCategory(@Body() addCategoryDto: AddCategoryDto) {
    return this.utilitiesService.addCategory(
      addCategoryDto.title,
      addCategoryDto.subtitle,
      addCategoryDto.order,
    );
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Remove category (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Category removed successfully',
    type: BaseResponseDto,
  })
  async removeCategory(@Param('id') id: string) {
    return this.utilitiesService.removeCategory(id);
  }

  // ============================================
  // PLATFORMS
  // ============================================

  @Post('platforms')
  @ApiOperation({ summary: 'Add platform (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Platform added successfully',
    type: BaseResponseDto,
  })
  async addPlatform(@Body() addPlatformDto: AddPlatformDto) {
    return this.utilitiesService.addPlatform(
      addPlatformDto.name,
      addPlatformDto.icon,
      addPlatformDto.order,
    );
  }

  @Delete('platforms/:id')
  @ApiOperation({ summary: 'Remove platform (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Platform removed successfully',
    type: BaseResponseDto,
  })
  async removePlatform(@Param('id') id: string) {
    return this.utilitiesService.removePlatform(id);
  }
}

