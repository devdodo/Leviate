import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ApplyTaskDto } from './dto/apply-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { BaseResponseDto } from '../common/dto/base-response.dto';

@ApiTags('Tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all tasks (public)' })
  @ApiResponse({
    status: 200,
    description: 'Tasks retrieved successfully',
    type: BaseResponseDto,
  })
  async getTasks(@Query() query: TaskQueryDto) {
    return this.tasksService.getTasks(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID (public)' })
  @ApiResponse({
    status: 200,
    description: 'Task retrieved successfully',
    type: BaseResponseDto,
  })
  async getTaskById(@Param('id') id: string) {
    return this.tasksService.getTaskById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({
    status: 201,
    description: 'Task created successfully',
    type: BaseResponseDto,
  })
  async createTask(
    @CurrentUser() user: any,
    @Body() createTaskDto: CreateTaskDto,
  ) {
    return this.tasksService.createTask(user.id, createTaskDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({
    status: 200,
    description: 'Task updated successfully',
    type: BaseResponseDto,
  })
  async updateTask(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(user.id, id, updateTaskDto);
  }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Apply for a task' })
  @ApiResponse({
    status: 201,
    description: 'Application submitted successfully',
    type: BaseResponseDto,
  })
  async applyForTask(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() applyTaskDto: ApplyTaskDto,
  ) {
    return this.tasksService.applyForTask(user.id, id, applyTaskDto);
  }

  @Get('my-jobs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get my jobs (for contributors)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'DECLINED', 'COMPLETED', 'EXPIRED'],
  })
  @ApiResponse({
    status: 200,
    description: 'My jobs retrieved successfully',
    type: BaseResponseDto,
  })
  async getMyJobs(
    @CurrentUser() user: any,
    @Query('status') status?: string,
  ) {
    return this.tasksService.getMyJobs(user.id, status as any);
  }

  @Get('my-created')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get my created tasks (for creators)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'EXPIRED'],
  })
  @ApiResponse({
    status: 200,
    description: 'My created tasks retrieved successfully',
    type: BaseResponseDto,
  })
  async getMyCreatedTasks(
    @CurrentUser() user: any,
    @Query('status') status?: string,
  ) {
    return this.tasksService.getMyCreatedTasks(user.id, status as any);
  }

  @Post(':id/save-draft')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Save task as draft' })
  @ApiResponse({
    status: 200,
    description: 'Draft saved successfully',
    type: BaseResponseDto,
  })
  async saveDraft(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() createTaskDto: CreateTaskDto,
  ) {
    return this.tasksService.saveDraft(user.id, id, createTaskDto);
  }
}

