import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UtilitiesService } from './utilities.service';
import { Public } from '../common/decorators/public.decorator';
import { BaseResponseDto } from '../common/dto/base-response.dto';

@ApiTags('Utilities')
@Controller('utilities')
export class UtilitiesController {
  constructor(private readonly utilitiesService: UtilitiesService) {}

  @Get('interests')
  @Public()
  @ApiOperation({ summary: 'Get all active interests (Public)' })
  @ApiResponse({
    status: 200,
    description: 'Interests retrieved successfully',
    type: BaseResponseDto,
  })
  async getInterests() {
    return this.utilitiesService.getInterests();
  }

  @Get('age-groups')
  @Public()
  @ApiOperation({ summary: 'Get all active age groups (Public)' })
  @ApiResponse({
    status: 200,
    description: 'Age groups retrieved successfully',
    type: BaseResponseDto,
  })
  async getAgeGroups() {
    return this.utilitiesService.getAgeGroups();
  }

  @Get('genders')
  @Public()
  @ApiOperation({ summary: 'Get all active genders (Public)' })
  @ApiResponse({
    status: 200,
    description: 'Genders retrieved successfully',
    type: BaseResponseDto,
  })
  async getGenders() {
    return this.utilitiesService.getGenders();
  }

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'Get all active categories (Public)' })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
    type: BaseResponseDto,
  })
  async getCategories() {
    return this.utilitiesService.getCategories();
  }

  @Get('platforms')
  @Public()
  @ApiOperation({ summary: 'Get all active platforms (Public)' })
  @ApiResponse({
    status: 200,
    description: 'Platforms retrieved successfully',
    type: BaseResponseDto,
  })
  async getPlatforms() {
    return this.utilitiesService.getPlatforms();
  }
}

