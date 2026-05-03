import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';

describe('TasksService direct Paystack payments', () => {
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
    );
  });

  it('initiates direct payment for an owned draft task using backend-calculated totals', async () => {
    prisma.task.findUnique.mockResolvedValue(buildTask());
    prisma.user.findUnique.mockResolvedValue(buildCreator());
    paystackService.initializePayment.mockResolvedValue({
      data: { authorization_url: 'https://checkout.paystack.com/direct' },
    });

    const result = await service.initiateDirectPayment('creator-1', 'task-1');

    expect(paystackService.initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'creator@example.com',
        amount: 10500,
        reference: expect.stringMatching(/^TASKDIRECT-/),
        callback_url: 'https://app.leviate.test/tasks/payment/callback',
        metadata: {
          taskId: 'task-1',
          userId: 'creator-1',
          type: 'TASK_DIRECT_PAYMENT',
        },
      }),
    );
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({
        paymentAuthorizationUrl: 'https://checkout.paystack.com/direct',
        paymentStatus: 'PENDING',
      }),
    });
    expect(result.data).toEqual(
      expect.objectContaining({
        amount: 10500,
        amountInKobo: 1050000,
        breakdown: {
          budget: 10000,
          platformFee: 500,
          total: 10500,
        },
      }),
    );
  });

  it('rejects direct payment initiation for another creator task', async () => {
    prisma.task.findUnique.mockResolvedValue(buildTask({ creatorId: 'creator-2' }));
    prisma.user.findUnique.mockResolvedValue(buildCreator());

    await expect(service.initiateDirectPayment('creator-1', 'task-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects direct payment initiation for unverified email and non-draft tasks', async () => {
    prisma.task.findUnique.mockResolvedValue(buildTask());
    prisma.user.findUnique.mockResolvedValue(buildCreator({ emailVerified: false }));

    await expect(service.initiateDirectPayment('creator-1', 'task-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.user.findUnique.mockResolvedValue(buildCreator());
    prisma.task.findUnique.mockResolvedValue(buildTask({ status: 'ACTIVE' }));

    await expect(service.initiateDirectPayment('creator-1', 'task-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('verifies direct payment only when Paystack amount, currency, metadata, and owner match', async () => {
    prisma.task.findUnique.mockResolvedValue(buildTask({ paymentReference: 'TASKDIRECT-1' }));
    paystackService.verifyPayment.mockResolvedValue({
      data: buildPaystackVerification(),
    });
    prisma.task.update.mockResolvedValue(buildTask({ paymentStatus: 'PAID' }));

    const result = await service.verifyDirectPayment('creator-1', 'TASKDIRECT-1');

    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({
        paymentStatus: 'PAID',
        paymentVerifiedAt: expect.any(Date),
      }),
    });
    expect(result.message).toBe('Direct payment verified successfully');
  });

  it('rejects direct payment verification for amount, currency, or metadata mismatch', async () => {
    prisma.task.findUnique.mockResolvedValue(buildTask({ paymentReference: 'TASKDIRECT-1' }));

    paystackService.verifyPayment.mockResolvedValueOnce({
      data: buildPaystackVerification({ amount: 1040000 }),
    });
    await expect(service.verifyDirectPayment('creator-1', 'TASKDIRECT-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    paystackService.verifyPayment.mockResolvedValueOnce({
      data: buildPaystackVerification({ currency: 'USD' }),
    });
    await expect(service.verifyDirectPayment('creator-1', 'TASKDIRECT-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    paystackService.verifyPayment.mockResolvedValueOnce({
      data: buildPaystackVerification({
        metadata: { taskId: 'task-1', userId: 'bad-user', type: 'TASK_DIRECT_PAYMENT' },
      }),
    });
    await expect(service.verifyDirectPayment('creator-1', 'TASKDIRECT-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('is idempotent for an already paid task with the same reference and owner', async () => {
    prisma.task.findUnique.mockResolvedValue(
      buildTask({ paymentReference: 'TASKDIRECT-1', paymentStatus: 'PAID' }),
    );

    const result = await service.verifyDirectPayment('creator-1', 'TASKDIRECT-1');

    expect(paystackService.verifyPayment).not.toHaveBeenCalled();
    expect(prisma.task.update).not.toHaveBeenCalled();
    expect(result.message).toBe('Payment already verified');
  });

  it('rejects direct payment verification for unknown references and wrong owners', async () => {
    prisma.task.findUnique.mockResolvedValueOnce(null);

    await expect(service.verifyDirectPayment('creator-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.task.findUnique.mockResolvedValueOnce(buildTask({ creatorId: 'creator-2' }));

    await expect(service.verifyDirectPayment('creator-1', 'TASKDIRECT-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects unsigned Paystack webhooks', async () => {
    paystackService.verifyWebhookSignature.mockReturnValue(false);

    await expect(
      service.handlePaymentWebhook({ event: 'charge.success', data: {} }, undefined, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
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
      reference: 'TASKDIRECT-1',
      amount: 1050000,
      currency: 'NGN',
      metadata: {
        taskId: 'task-1',
        userId: 'creator-1',
        type: 'TASK_DIRECT_PAYMENT',
      },
      paid_at: '2026-05-03T10:00:00.000Z',
      ...overrides,
    };
  }
});
