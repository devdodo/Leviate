import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { AIService } from '../common/services/ai.service';
import { WalletService } from '../wallet/wallet.service';
import {
  contributorNetPayoutAmount,
  countCompletedTaskPayouts,
  resolveRequiredContributorSlots,
} from '../common/utils/task-payout.util';
import { ReputationService } from '../reputation/reputation.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import {
  Prisma,
  VerificationStatus,
  ApplicationStatus,
  UserRole,
  UserType,
  TransactionCategory,
  TransactionStatus,
} from '@prisma/client';
import { ReviewSubmissionsQueryDto } from './dto/review-submissions-query.dto';

@Injectable()
export class SubmissionsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AIService,
    private walletService: WalletService,
    private reputationService: ReputationService,
  ) {}

  private submissionProofSummary(submission: {
    proofs: unknown;
    submissionText?: string | null;
  }): string {
    const text = submission.submissionText?.trim();
    if (text) return text;
    const raw = submission.proofs as Array<{ proofType?: string; proofUrl?: string }>;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw
        .map((p) => `[${p.proofType ?? 'PROOF'}] ${p.proofUrl ?? ''}`)
        .join('\n');
    }
    return '';
  }

  private isStaffRole(role: string | undefined): boolean {
    return role === UserRole.ADMIN || role === UserRole.SUPERADMIN;
  }

  private readonly submissionReviewInclude = {
    task: {
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        budget: true,
        platformFeePercentage: true,
        audiencePreferences: true,
        targeting: true,
        scheduleEnd: true,
        applications: {
          where: {
            status: {
              in: [ApplicationStatus.APPROVED, ApplicationStatus.COMPLETED],
            },
          },
          select: { id: true },
        },
      },
    },
    application: {
      include: {
        tasker: {
          select: {
            id: true,
            email: true,
            reputationScore: true,
            profile: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    },
    verifiedBy: {
      select: { id: true, email: true },
    },
  } satisfies Prisma.TaskSubmissionInclude;

  /** Staff review queue (default: pending verification). */
  async listSubmissionsForReview(query: ReviewSubmissionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const status = query.status ?? VerificationStatus.PENDING;

    const where: Prisma.TaskSubmissionWhereInput = { verificationStatus: status };

    const [submissions, total] = await Promise.all([
      this.prisma.taskSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.submissionReviewInclude,
      }),
      this.prisma.taskSubmission.count({ where }),
    ]);

    const items = submissions.map((s) => ({
      ...s,
      estimatedPayout: contributorNetPayoutAmount(s.task),
    }));

    return {
      message: 'Submissions retrieved successfully',
      data: { submissions: items },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        status,
      },
    };
  }

  async getSubmissionForReview(id: string) {
    const submission = await this.prisma.taskSubmission.findUnique({
      where: { id },
      include: this.submissionReviewInclude,
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const estimatedPayout = contributorNetPayoutAmount(submission.task);

    return {
      message: 'Submission retrieved successfully',
      data: {
        ...submission,
        estimatedPayout,
      },
    };
  }

  /**
   * AI brief and task context for staff reviewing submissions for a given task.
   */
  async getTaskAiBriefForAdmin(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        status: true,
        taskType: true,
        contentType: true,
        platforms: true,
        hashtags: true,
        buzzwords: true,
        commentsInstructions: true,
        aiGeneratedBrief: true,
        contributorSummary: true,
        resourceLink: true,
        scheduleStart: true,
        scheduleEnd: true,
        createdAt: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return {
      message: 'Task AI brief retrieved successfully',
      data: {
        taskId: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        status: task.status,
        taskType: task.taskType,
        contentType: task.contentType,
        platforms: task.platforms,
        hashtags: task.hashtags,
        buzzwords: task.buzzwords,
        commentsInstructions: task.commentsInstructions,
        resourceLink: task.resourceLink,
        scheduleStart: task.scheduleStart,
        scheduleEnd: task.scheduleEnd,
        createdAt: task.createdAt,
        aiBrief: task.aiGeneratedBrief,
        contributorSummary: task.contributorSummary,
      },
    };
  }

  async createSubmission(userId: string, createSubmissionDto: CreateSubmissionDto) {
    const { taskId, applicationId, proof, notes } = createSubmissionDto;

    const submitter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userType: true },
    });
    if (!submitter || submitter.userType !== UserType.CONTRIBUTOR) {
      throw new ForbiddenException('Only contributors can submit task proof');
    }

    // Verify application belongs to user
    const application = await this.prisma.taskApplication.findUnique({
      where: { id: applicationId },
      include: {
        task: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.taskerId !== userId) {
      throw new ForbiddenException('You can only submit for your own applications');
    }

    if (application.taskId !== taskId) {
      throw new BadRequestException('Application does not match task');
    }

    if (application.status !== ApplicationStatus.APPROVED) {
      throw new BadRequestException('Application must be approved to submit');
    }

    // Check if already submitted
    const existingSubmission = await this.prisma.taskSubmission.findFirst({
      where: {
        applicationId,
        verificationStatus: { not: VerificationStatus.REJECTED },
      },
    });

    if (existingSubmission) {
      throw new BadRequestException('Submission already exists for this application');
    }

    // Create submission
    const submission = await this.prisma.taskSubmission.create({
      data: {
        taskId,
        applicationId,
        taskerId: userId,
        proofs: proof as unknown as Prisma.InputJsonValue,
        submissionText: notes ?? null,
        verificationStatus: VerificationStatus.PENDING,
      } satisfies Prisma.TaskSubmissionUncheckedCreateInput,
    });

    // Update application status
    await this.prisma.taskApplication.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.COMPLETED,
      },
    });

    // Create notification for admin (submission pending review)
    // Get all admins
    const admins = await this.prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'SUPERADMIN'] as any },
        status: 'ACTIVE',
      },
    });

    // Notify all admins about pending submission
    await Promise.all(
      admins.map((admin) =>
        this.prisma.notification.create({
          data: {
            receiverId: admin.id,
            type: 'SUBMISSION_VERIFIED', // Reuse type, but it's actually pending
            title: 'New Task Submission Pending Review',
            message: `A new submission requires admin review for task: ${application.task.title}`,
            data: {
              taskId,
              submissionId: submission.id,
              applicationId,
            },
          },
        }),
      ),
    );

    // Also notify creator
    await this.prisma.notification.create({
      data: {
        receiverId: application.task.creatorId,
        type: 'SUBMISSION_VERIFIED',
        title: 'New Task Submission',
        message: `A submission has been made for task: ${application.task.title}. Awaiting admin verification.`,
        data: {
          taskId,
          submissionId: submission.id,
        },
      },
    });

    return {
      message: 'Submission created successfully. Awaiting admin verification.',
      data: submission,
    };
  }

  async getPendingSubmissions(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      this.prisma.taskSubmission.findMany({
        where: {
          verificationStatus: { in: [VerificationStatus.PENDING, VerificationStatus.VERIFYING] },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          task: {
            select: { id: true, title: true, creatorId: true },
          },
          application: {
            include: {
              tasker: {
                select: { id: true, email: true, reputationScore: true },
              },
            },
          },
        },
      }),
      this.prisma.taskSubmission.count({
        where: {
          verificationStatus: { in: [VerificationStatus.PENDING, VerificationStatus.VERIFYING] },
        },
      }),
    ]);

    return {
      message: 'Pending submissions retrieved successfully',
      data: submissions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async verifySubmission(id: string, adminUserId: string, comment?: string) {
    const approver = await this.prisma.user.findUnique({
      where: { id: adminUserId },
      select: { role: true, userType: true },
    });
    if (!approver || !this.isStaffRole(approver.role)) {
      throw new ForbiddenException('Only admin or super admin can approve submissions');
    }

    const submission = await this.prisma.taskSubmission.findUnique({
      where: { id },
      include: { task: true },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.verificationStatus === VerificationStatus.VERIFIED) {
      throw new BadRequestException('Submission is already verified');
    }
    if (submission.verificationStatus === VerificationStatus.REJECTED) {
      throw new BadRequestException('Cannot approve a rejected submission');
    }

    const updated = await this.prisma.taskSubmission.update({
      where: { id },
      data: {
        verificationStatus: VerificationStatus.VERIFIED,
        verifiedAt: new Date(),
        verifiedById: adminUserId,
        adminComment: comment ?? null,
      },
      include: { task: true },
    });

    await this.prisma.adminAction.create({
      data: {
        adminId: adminUserId,
        actionType: 'OVERRIDE_VERIFICATION',
        targetTaskId: submission.taskId,
        reason: comment ?? 'Submission approved by staff',
      },
    });

    const payoutAmount = await this.processPayout(updated);

    await this.prisma.notification.create({
      data: {
        receiverId: updated.taskerId,
        type: 'SUBMISSION_VERIFIED',
        title: 'Submission approved',
        message: `Your submission for "${updated.task.title}" was approved. ₦${payoutAmount} has been credited to your wallet.`,
        data: {
          taskId: updated.taskId,
          submissionId: id,
          amount: payoutAmount,
        },
      },
    });

    return {
      message: 'Submission approved and contributor credited successfully',
      data: {
        submissionId: id,
        status: VerificationStatus.VERIFIED,
        verifiedById: adminUserId,
        payoutAmount,
      },
    };
  }

  async rejectSubmission(id: string, adminUserId: string, comment: string) {
    const approver = await this.prisma.user.findUnique({
      where: { id: adminUserId },
      select: { role: true },
    });
    if (!approver || !this.isStaffRole(approver.role)) {
      throw new ForbiddenException('Only admin or super admin can reject submissions');
    }

    const submission = await this.prisma.taskSubmission.findUnique({
      where: { id },
      include: { task: true },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.verificationStatus === VerificationStatus.VERIFIED) {
      throw new BadRequestException('Cannot reject an already verified submission');
    }
    if (submission.verificationStatus === VerificationStatus.REJECTED) {
      throw new BadRequestException('Submission is already rejected');
    }

    await this.prisma.taskSubmission.update({
      where: { id },
      data: {
        verificationStatus: VerificationStatus.REJECTED,
        rejectedAt: new Date(),
        verifiedById: adminUserId,
        adminComment: comment,
      },
    });

    await this.prisma.taskApplication.update({
      where: { id: submission.applicationId },
      data: { status: ApplicationStatus.APPROVED },
    });

    await this.prisma.adminAction.create({
      data: {
        adminId: adminUserId,
        actionType: 'RESOLVE_DISPUTE', // Closest match; consider adding REJECT_SUBMISSION to enum
        targetTaskId: submission.taskId,
        reason: comment,
      },
    });

    await this.prisma.notification.create({
      data: {
        receiverId: submission.taskerId,
        type: 'SUBMISSION_REJECTED',
        title: 'Submission Rejected',
        message: `Your submission for task "${submission.task.title}" was rejected. ${comment}`,
        data: { taskId: submission.taskId, submissionId: id },
      },
    });

    return {
      message: 'Submission rejected successfully',
      data: { submissionId: id, status: VerificationStatus.REJECTED },
    };
  }

  async getSubmission(id: string, userId: string, userRole?: string) {
    const submission = await this.prisma.taskSubmission.findUnique({
      where: { id },
      include: {
        task: {
          include: {
            creator: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        application: {
          include: {
            tasker: {
              select: {
                id: true,
                email: true,
                reputationScore: true,
              },
            },
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const isStaff = this.isStaffRole(userRole);
    if (
      !isStaff &&
      submission.task.creatorId !== userId &&
      submission.taskerId !== userId
    ) {
      throw new ForbiddenException('You do not have access to this submission');
    }

    return {
      message: 'Submission retrieved successfully',
      data: submission,
    };
  }

  private async verifySubmissionAsync(submissionId: string, taskId: string) {
    try {
      const submission = await this.prisma.taskSubmission.findUnique({
        where: { id: submissionId },
        include: {
          task: true,
        },
      });

      if (!submission || submission.verificationStatus !== VerificationStatus.VERIFYING) {
        return;
      }

      // Get LLM context from task
      const llmContext = submission.task.llmContextFile || submission.task.aiGeneratedBrief || '';

      // For MVP, we'll do a simple verification
      // In production, this would extract text from screenshot (OCR) or analyze link
      const submissionText = this.submissionProofSummary(submission);

      // Verify using AI
      const verificationResult = await this.aiService.verifySubmission(
        submissionText,
        llmContext,
        80, // 80% threshold
      );

      if (verificationResult.verified) {
        // Mark as verified
        await this.prisma.taskSubmission.update({
          where: { id: submissionId },
          data: {
            verificationStatus: VerificationStatus.VERIFIED,
            aiVerificationScore: verificationResult.score,
            verifiedAt: new Date(),
          },
        });

        // Process payout
        await this.processPayout(submission);
      } else {
        // Mark as rejected
        await this.prisma.taskSubmission.update({
          where: { id: submissionId },
          data: {
            verificationStatus: VerificationStatus.REJECTED,
            aiVerificationScore: verificationResult.score,
          },
        });

        // Decrease reputation
        await this.reputationService.decreaseReputation(
          submission.taskerId,
          10,
          'Task verification failed',
        );

        // Create notification
        await this.prisma.notification.create({
          data: {
            receiverId: submission.taskerId,
            type: 'SUBMISSION_REJECTED',
            title: 'Submission Rejected',
            message: `Your submission for task "${submission.task.title}" was rejected. Reason: ${verificationResult.reason}`,
            data: {
              taskId,
              submissionId,
            },
          },
        });
      }
    } catch (error) {
      // Log error and mark as pending for manual review
      console.error('Verification error:', error);
      await this.prisma.taskSubmission.update({
        where: { id: submissionId },
        data: {
          verificationStatus: VerificationStatus.PENDING,
        },
      });
    }
  }

  private async processPayout(submission: {
    id: string;
    taskId: string;
    taskerId: string;
    task?: { title: string };
  }): Promise<number> {
    const existingPayout = await this.prisma.walletTransaction.findFirst({
      where: {
        referenceId: submission.id,
        transactionCategory: TransactionCategory.TASK_PAYOUT,
        status: TransactionStatus.COMPLETED,
      },
    });
    if (existingPayout) {
      return Number(existingPayout.amount);
    }

    const task = await this.prisma.task.findUnique({
      where: { id: submission.taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found for payout');
    }

    const requiredContributors = resolveRequiredContributorSlots(task);
    const allottedPayout = contributorNetPayoutAmount(task);

    if (allottedPayout <= 0) {
      throw new BadRequestException('Task payout amount is invalid');
    }

    const payoutsIssued = await countCompletedTaskPayouts(
      this.prisma,
      task.id,
      TransactionCategory.TASK_PAYOUT,
      TransactionStatus.COMPLETED,
    );
    if (payoutsIssued >= requiredContributors) {
      throw new BadRequestException(
        `All ${requiredContributors} allotted contributor payouts for this campaign have already been issued`,
      );
    }

    const taskerAmount = allottedPayout;

    await this.walletService.credit(
      submission.taskerId,
      taskerAmount,
      'TASK_PAYOUT',
      `Payout for task: ${task.title}`,
      { referenceId: submission.id, taskId: task.id, submissionId: submission.id },
    );

    await this.reputationService.increaseReputation(
      submission.taskerId,
      5,
      'Task completed and verified',
    );

    await this.prisma.notification.create({
      data: {
        receiverId: submission.taskerId,
        type: 'PAYOUT_RECEIVED',
        title: 'Payout Received',
        message: `You received ₦${taskerAmount} for completing task: ${task.title}`,
        data: {
          taskId: task.id,
          submissionId: submission.id,
          amount: taskerAmount,
        },
      },
    });

    return taskerAmount;
  }

  async overrideVerification(
    submissionId: string,
    verified: boolean,
    adminUserId: string,
  ) {
    const submission = await this.prisma.taskSubmission.findUnique({
      where: { id: submissionId },
      include: {
        task: true,
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const newStatus = verified
      ? VerificationStatus.VERIFIED
      : VerificationStatus.REJECTED;

    await this.prisma.taskSubmission.update({
      where: { id: submissionId },
      data: {
        verificationStatus: newStatus,
        verifiedAt: verified ? new Date() : null,
      },
    });

    // Log admin action
    await this.prisma.adminAction.create({
      data: {
        adminId: adminUserId,
        actionType: 'OVERRIDE_VERIFICATION',
        targetTaskId: submission.taskId,
        reason: `Override verification: ${verified ? 'approved' : 'rejected'}`,
      },
    });

    if (verified) {
      await this.processPayout(submission);
    }

    return {
      message: `Verification ${verified ? 'approved' : 'rejected'} successfully`,
      data: {
        submissionId,
        status: newStatus,
      },
    };
  }
}

