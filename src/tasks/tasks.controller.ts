import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
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

  @Get('task-types')
  @Public()
  @ApiOperation({ summary: 'Get available task types and categories for task creation' })
  @ApiResponse({
    status: 200,
    description:
      'Task types retrieved successfully. Returns `categories` (MAKE_POST, COMMENT_POST, etc.), `taskTypes` (SINGLE, MULTI), content types, and schedule types.',
    type: BaseResponseDto,
  })
  async getTaskTypes() {
    return this.tasksService.getTaskTypes();
  }

  @Get('marketplace')
  @Public()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Marketplace task feed (public)',
    description:
      'Lists published (ACTIVE) tasks shaped for job cards: budget label, skills, payment verified, client rating, posted time. Optional JWT applies contributor filters when logged in.',
  })
  @ApiResponse({ status: 200, description: 'Marketplace tasks', type: BaseResponseDto })
  async getMarketplace(@Query() query: TaskQueryDto, @CurrentUser() user?: any) {
    return this.tasksService.getMarketplaceList(query, user?.id);
  }

  @Get('marketplace/:id')
  @Public()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Marketplace task detail (public)',
    description:
      'Full job page payload. Send Bearer token to receive apply eligibility for the current user.',
  })
  @ApiResponse({ status: 200, description: 'Task detail + eligibility', type: BaseResponseDto })
  @ApiResponse({ status: 404, description: 'Not found or not published' })
  async getMarketplaceDetail(@Param('id') id: string, @CurrentUser() user?: any) {
    return this.tasksService.getMarketplaceDetail(id, user?.id);
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

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all tasks (filtered by user requirements if authenticated)' })
  @ApiResponse({
    status: 200,
    description: 'Tasks retrieved successfully',
    type: BaseResponseDto,
  })
  async getTasks(@Query() query: TaskQueryDto, @CurrentUser() user?: any) {
    return this.tasksService.getTasks(query, user?.id);
  }

  @Get(':id/similar')
  @Public()
  @ApiOperation({
    summary: 'Similar tasks (same category)',
    description: 'For “Similar jobs” sections; excludes the given task id.',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Max items (default 6, max 20)' })
  @ApiResponse({ status: 200, description: 'Similar marketplace cards', type: BaseResponseDto })
  async getSimilarTasks(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? parseInt(limit, 10) : 6;
    return this.tasksService.getSimilarTasks(id, Number.isFinite(n) ? n : 6);
  }

  @Get(':id/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get task summary/preview (for creators before publishing)' })
  @ApiResponse({
    status: 200,
    description: 'Task summary retrieved successfully',
    type: BaseResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your task' })
  async getTaskSummary(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.tasksService.getTaskSummary(user.id, id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get task by ID (filtered by user requirements)' })
  @ApiResponse({
    status: 200,
    description: 'Task retrieved successfully',
    type: BaseResponseDto,
  })
  @ApiResponse({ status: 403, description: 'User does not meet task requirements' })
  async getTaskById(@Param('id') id: string, @CurrentUser() user?: any) {
    return this.tasksService.getTaskById(id, user?.id);
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

  @Post('direct-payment/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify direct Paystack payment for a draft task',
    description:
      'Frontend calls this with the Paystack reference. Backend verifies status, amount, currency, metadata, and task ownership before marking the task as paid.',
  })
  @ApiBody({ schema: { type: 'object', properties: { reference: { type: 'string' } }, required: ['reference'] } })
  @ApiResponse({
    status: 200,
    description: 'Direct payment verified successfully. Task can now be published.',
    type: BaseResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Payment verification failed' })
  async verifyDirectPayment(
    @CurrentUser() user: any,
    @Body() body: { reference: string },
  ) {
    return this.tasksService.verifyDirectPayment(user.id, body.reference);
  }

  @Post('payment/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify task payment (call after Paystack SDK completes)',
    description:
      'Frontend calls this with the reference from Paystack callback. Backend verifies with Paystack and marks task as PAID, allowing publish.',
  })
  @ApiBody({ schema: { type: 'object', properties: { reference: { type: 'string' } }, required: ['reference'] } })
  @ApiResponse({
    status: 200,
    description: 'Payment verified successfully. Task can now be published.',
    type: BaseResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Payment verification failed' })
  async verifyPayment(@Body() body: { reference: string }) {
    return this.tasksService.verifyPayment(body.reference);
  }

  @Post('payment/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paystack webhook endpoint for payment notifications' })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  async handlePaymentWebhook(@Body() payload: any, @Req() req: any) {
    const signature = req.headers?.['x-paystack-signature'];
    return this.tasksService.handlePaymentWebhook(payload, signature, req.rawBody);
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

  @Post(':id/initiate-payment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Initiate payment for a draft task (required before publishing)' })
  @ApiResponse({
    status: 200,
    description: 'Payment URL generated. Redirect user to authorizationUrl to complete payment.',
    type: BaseResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Task already paid or not a draft' })
  async initiatePayment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tasksService.initiatePayment(user.id, id);
  }

  @Post(':id/direct-payment/initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Initiate direct Paystack payment for a draft task' })
  @ApiResponse({
    status: 200,
    description: 'Direct payment checkout data generated.',
    type: BaseResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Task already paid or not a draft' })
  async initiateDirectPayment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tasksService.initiateDirectPayment(user.id, id);
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

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Publish a draft task to make it visible to contributors' })
  @ApiResponse({
    status: 200,
    description: 'Task published successfully',
    type: BaseResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your task' })
  @ApiResponse({ status: 400, description: 'Task cannot be published (missing fields or already published)' })
  async publishTask(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.tasksService.publishTask(user.id, id);
  }
}
