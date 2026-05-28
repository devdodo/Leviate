import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';

describe('TasksService Paystack payments', () => {
  let service: TasksService;
  let prisma: any;
  let paystackService: any;
  let configService: any;

  beforeEach(() => {
    prisma = {
      task: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };
    paystackService = {
      initializePayment: jest.fn(),
      verifyPayment: jest.fn(),
      verifyWebhookSignature: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue('https://app.leviate.test'),
    };

    service = new TasksService(
      prisma,
      { generateTaskBrief: jest.fn() } as any,
      {} as any,
      paystackService,
      configService,
      {} as any,
    );
  });

  it('reuses pending payment reference on re-initiate', async () => {
    prisma.task.findUnique.mockResolvedValue(
      buildTask({ paymentReference: 'TASK_EXISTING', paymentStatus: 'PENDING' }),
    );
    prisma.user.findUnique.mockResolvedValue(buildCreator());
    paystackService.initializePayment.mockResolvedValue({
      data: { authorization_url: 'https://checkout.paystack.com/reuse' },
    });
    prisma.task.update.mockResolvedValue({});

    await service.initiatePayment('creator-1', 'task-1');

    expect(paystackService.initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({ reference: 'TASK_EXISTING' }),
    );
  });

  it('verifies payment with Paystack reference only', async () => {
    prisma.task.findUnique
      .mockResolvedValueOnce(buildTask({ paymentReference: 'TASK_REF_1' }))
      .mockResolvedValueOnce(null);
    paystackService.verifyPayment.mockResolvedValue({
      data: buildPaystackVerification(),
    });
    prisma.task.update.mockResolvedValue(buildTask({ paymentStatus: 'PAID' }));

    const result = await service.verifyPayment('creator-1', 'TASK_REF_1');

    expect(paystackService.verifyPayment).toHaveBeenCalledWith('TASK_REF_1');
    expect(result.message).toBe('Payment verified successfully');
  });

  it('resolves task from Paystack metadata when DB reference was overwritten', async () => {
    prisma.task.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildTask({ paymentReference: 'TASK_NEW' }));
    paystackService.verifyPayment.mockResolvedValue({
      data: buildPaystackVerification({ reference: 'TASK_PAID_REF' }),
    });
    prisma.task.update.mockResolvedValue(buildTask({ paymentStatus: 'PAID' }));

    await service.verifyPayment('creator-1', 'TASK_PAID_REF');

    expect(prisma.task.findUnique).toHaveBeenLastCalledWith({ where: { id: 'task-1' } });
  });

  it('is idempotent for an already paid task', async () => {
    prisma.task.findUnique.mockResolvedValue(
      buildTask({ paymentReference: 'TASK_REF_1', paymentStatus: 'PAID' }),
    );

    const result = await service.verifyPayment('creator-1', 'TASK_REF_1');

    expect(paystackService.verifyPayment).not.toHaveBeenCalled();
    expect(result.message).toBe('Payment already verified');
  });

  it('rejects verification for wrong owners', async () => {
    prisma.task.findUnique.mockResolvedValue(
      buildTask({ creatorId: 'creator-2', paymentReference: 'TASK_REF_1' }),
    );
    paystackService.verifyPayment.mockResolvedValue({
      data: buildPaystackVerification(),
    });

    await expect(service.verifyPayment('creator-1', 'TASK_REF_1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  function buildCreator(overrides: Record<string, unknown> = {}) {
    return {
      id: 'creator-1',
      email: 'creator@example.com',
      userType: 'CREATOR',
      emailVerified: true,
      ...overrides,
    };
  }

  function buildTask(overrides: Record<string, unknown> = {}) {
    return {
      id: 'task-1',
      creatorId: 'creator-1',
      status: 'DRAFT',
      budget: 10000,
      platformFeePercentage: 5,
      paymentStatus: 'PENDING',
      paymentReference: null,
      ...overrides,
    };
  }

  function buildPaystackVerification(overrides: Record<string, unknown> = {}) {
    return {
      status: 'success',
      reference: 'TASK_REF_1',
      amount: 1050000,
      currency: 'NGN',
      metadata: {
        taskId: 'task-1',
        userId: 'creator-1',
        type: 'TASK_PAYMENT',
      },
      paid_at: '2026-05-03T10:00:00.000Z',
      ...overrides,
    };
  }
});
