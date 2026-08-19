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
  let aiService: any;

  beforeEach(() => {
    prisma = {
      task: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn((args: any) => ({ id: 'task-new', ...args.data })),
      },
      user: {
        findUnique: jest.fn(),
      },
    };
    paystackService = {
      initializePayment: jest.fn(),
      verifyPayment: jest.fn(),
      getKeyMode: jest.fn().mockReturnValue('test'),
    };
    configService = {
      get: jest.fn().mockReturnValue('https://app.leviate.test'),
    };

    aiService = {
      generateTaskBrief: jest.fn().mockResolvedValue({ brief: 'b', llmContext: 'c' }),
      moderateTaskContent: jest
        .fn()
        .mockResolvedValue({ approved: true, violations: [], reason: '' }),
    };

    service = new TasksService(
      prisma,
      aiService as any,
      {} as any,
      paystackService,
      configService,
      {} as any,
      {} as any,
    );
  });

  it('reuses pending payment reference on re-initiate', async () => {
    prisma.task.findUnique.mockResolvedValue(
      buildTask({ paymentReference: 'TASK_EXISTING', paymentStatus: 'PENDING' }),
    );
    prisma.user.findUnique.mockResolvedValue(buildCreator());
    paystackService.initializePayment.mockResolvedValue({
      data: {
        authorization_url: 'https://checkout.paystack.com/reuse',
        reference: 'TASK_EXISTING',
      },
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

  it('charges a current campaign exactly its budget, not budget plus fee again', async () => {
    // budget is already all-in: 10,000 pool + 700 platform fee at 7%.
    prisma.task.findUnique.mockResolvedValue(
      buildTask({ budget: 10700, payoutPool: 10000, platformFeePercentage: 7 }),
    );
    prisma.user.findUnique.mockResolvedValue(buildCreator());
    paystackService.initializePayment.mockResolvedValue({
      data: {
        authorization_url: 'https://checkout.paystack.com/new',
        reference: 'TASK_NEW',
      },
    });
    prisma.task.update.mockResolvedValue({});

    await service.initiatePayment('creator-1', 'task-1');

    expect(paystackService.initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10700 }),
    );
  });

  it('accepts a payment of exactly the all-in budget for a current campaign', async () => {
    prisma.task.findUnique
      .mockResolvedValueOnce(
        buildTask({
          paymentReference: 'TASK_REF_1',
          budget: 10700,
          payoutPool: 10000,
          platformFeePercentage: 7,
        }),
      )
      .mockResolvedValueOnce(null);
    paystackService.verifyPayment.mockResolvedValue({
      data: buildPaystackVerification({ amount: 1070000 }),
    });
    prisma.task.update.mockResolvedValue(buildTask({ paymentStatus: 'PAID' }));

    const result = await service.verifyPayment('creator-1', 'TASK_REF_1');

    expect(result.message).toBe('Payment verified successfully');
  });

  it('still adds the fee at checkout for legacy pool-only budgets', async () => {
    // No payoutPool: budget is the bare pool, so the 5% is added as before.
    prisma.task.findUnique.mockResolvedValue(buildTask({ budget: 10000 }));
    prisma.user.findUnique.mockResolvedValue(buildCreator());
    paystackService.initializePayment.mockResolvedValue({
      data: {
        authorization_url: 'https://checkout.paystack.com/new',
        reference: 'TASK_NEW',
      },
    });
    prisma.task.update.mockResolvedValue({});

    await service.initiatePayment('creator-1', 'task-1');

    expect(paystackService.initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10500 }),
    );
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

  describe('task creation', () => {
    const creator = {
      id: 'creator-1',
      userType: 'CREATOR',
      emailVerified: true,
    };

    // Exactly the payload that was failing, with the budget corrected to the
    // all-in total: 3500 x 70 = 245,000 pool + 7% fee = 262,150.
    const dto = {
      taskType: 'SINGLE',
      category: 'MAKE_POST',
      title: 'Do WWYLM Video',
      description: 'Help do a video with the song WWYLM.',
      platform: 'tiktok',
      resourceLink: 'https://tiktok.com/cccccxx',
      contentType: 'VIDEO',
      scheduleType: 'FIXED',
      scheduleStart: '2026-08-19T00:00:00Z',
      scheduleEnd: '2026-09-27T00:00:00Z',
      commentsInstructions: '',
      hashtags: ['#wwylm'],
      buzzwords: ['WWYLM'],
      budget: 262150,
      contributorCount: 70,
      targeting: { gender: 'ALL' },
    } as any;

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(creator);
    });

    it('keeps resourceLink on a MAKE_POST task', async () => {
      await service.createTask('creator-1', dto);

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'MAKE_POST',
            resourceLink: 'https://tiktok.com/cccccxx',
          }),
        }),
      );
    });

    it('stores the payout pool separately from the funded budget', async () => {
      await service.createTask('creator-1', dto);

      const data = prisma.task.create.mock.calls[0][0].data;
      expect(data.budget).toBe(262150);
      expect(data.payoutPool).toBe(245000);
      expect(data.platformFeePercentage).toBe(7);
      expect(data.contributorSlots).toBe(70);
    });

    it('calculates the budget itself when the client omits it', async () => {
      const { budget, ...withoutBudget } = dto;

      await service.createTask('creator-1', withoutBudget);

      const data = prisma.task.create.mock.calls[0][0].data;
      expect(data.budget).toBe(262150);
      expect(data.payoutPool).toBe(245000);
      expect(data.contributorSlots).toBe(70);
    });

    it('stores its own figure rather than a budget inside the rounding tolerance', async () => {
      await service.createTask('creator-1', { ...dto, budget: 262149 });

      // Accepted (within +/-1), but the charged amount must be the server's.
      expect(prisma.task.create.mock.calls[0][0].data.budget).toBe(262150);
    });

    it('rejects a budget that omits the platform fee', async () => {
      // 245,000 is the payout pool — what the client was sending before the
      // fee moved to the creator.
      await expect(
        service.createTask('creator-1', { ...dto, budget: 245000 }),
      ).rejects.toThrow(/262150/);
    });

    it('nulls resourceLink only when the creator omits it', async () => {
      const { resourceLink, ...withoutLink } = dto;
      await service.createTask('creator-1', withoutLink);

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ resourceLink: null }),
        }),
      );
    });
  });
});

describe('TasksService new-task broadcast', () => {
  let service: TasksService;
  let prisma: any;
  let emailService: any;
  let configService: any;

  const publishable = {
    id: 'task-1',
    creatorId: 'creator-1',
    status: 'DRAFT',
    paymentStatus: 'PAID',
    title: 'Summer video push',
    taskType: 'SINGLE',
    category: 'MAKE_POST',
    platforms: ['instagram'],
    scheduleType: 'FIXED',
    scheduleStart: new Date('2026-09-01T10:00:00Z'),
    scheduleEnd: new Date('2026-09-30T10:00:00Z'),
    budget: 10000,
    contributorSlots: 4,
    platformFeePercentage: 5,
  };

  /** One page of contributors per call, then an empty page to end the walk. */
  function contributorPages(...pages: any[][]) {
    const queue = [...pages, []];
    return jest.fn().mockImplementation(() => Promise.resolve(queue.shift() ?? []));
  }

  beforeEach(() => {
    prisma = {
      task: {
        findUnique: jest.fn().mockResolvedValue(publishable),
        update: jest.fn().mockResolvedValue(publishable),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    emailService = {
      sendNewTaskAvailable: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }),
    };
    configService = {
      get: jest.fn().mockImplementation((key: string) =>
        key === 'FRONTEND_URL' ? 'https://app.leviate.test' : undefined,
      ),
    };

    service = new TasksService(
      prisma,
      { generateTaskBrief: jest.fn() } as any,
      {} as any,
      {} as any,
      configService,
      {} as any,
      emailService,
    );
  });

  it('emails contributors with a link to the task once it is published', async () => {
    prisma.user.findMany = contributorPages([
      { id: 'u1', email: 'a@example.com', profile: { firstName: 'Ada' } },
      { id: 'u2', email: 'b@example.com', profile: null },
    ]);

    await service.publishTask('creator-1', 'task-1');
    await flushBroadcast();

    expect(emailService.sendNewTaskAvailable).toHaveBeenCalledTimes(1);
    const [recipients, details] = emailService.sendNewTaskAvailable.mock.calls[0];
    expect(recipients).toEqual([
      { email: 'a@example.com', firstName: 'Ada' },
      { email: 'b@example.com', firstName: undefined },
    ]);
    expect(details.taskUrl).toBe('https://app.leviate.test/tasks/task-1');
    expect(details.campaignTitle).toBe('Summer video push');
    expect(details.category).toBe('Create Post');
    // 10,000 over 4 slots, paid in full — the platform fee is charged to the
    // creator at task creation, never deducted from the contributor.
    expect(details.payout).toBe(2500);
  });

  it('excludes the creator and only mails active, verified contributors', async () => {
    prisma.user.findMany = contributorPages([
      { id: 'u1', email: 'a@example.com', profile: null },
    ]);

    await service.publishTask('creator-1', 'task-1');
    await flushBroadcast();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userType: 'CONTRIBUTOR',
          status: 'ACTIVE',
          emailVerified: true,
          id: { not: 'creator-1' },
        }),
      }),
    );
  });

  it('pages through contributors beyond the batch limit', async () => {
    const page = (n: number, offset: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `u${offset + i}`,
        email: `u${offset + i}@example.com`,
        profile: null,
      }));
    prisma.user.findMany = contributorPages(page(100, 0), page(20, 100));

    await service.publishTask('creator-1', 'task-1');
    await flushBroadcast();

    expect(emailService.sendNewTaskAvailable).toHaveBeenCalledTimes(2);
    // Second page continues after the last id of the first.
    expect(prisma.user.findMany.mock.calls[1][0]).toMatchObject({
      cursor: { id: 'u99' },
      skip: 1,
    });
  });

  it('publishes successfully even when the broadcast throws', async () => {
    prisma.user.findMany = jest.fn().mockRejectedValue(new Error('db down'));

    const result = await service.publishTask('creator-1', 'task-1');
    await flushBroadcast();

    expect(result.message).toContain('published successfully');
    expect(emailService.sendNewTaskAvailable).not.toHaveBeenCalled();
  });

  it('honours the TASK_BROADCAST_EMAIL_ENABLED off switch', async () => {
    configService.get.mockImplementation((key: string) =>
      key === 'TASK_BROADCAST_EMAIL_ENABLED' ? 'false' : 'https://app.leviate.test',
    );
    prisma.user.findMany = contributorPages([
      { id: 'u1', email: 'a@example.com', profile: null },
    ]);

    await service.publishTask('creator-1', 'task-1');
    await flushBroadcast();

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(emailService.sendNewTaskAvailable).not.toHaveBeenCalled();
  });

  /** The broadcast is fired without await, so let its promise chain settle. */
  function flushBroadcast() {
    return new Promise((resolve) => setImmediate(resolve));
  }

});
