import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { AIService } from '../common/services/ai.service';
import { WalletService } from '../wallet/wallet.service';
import { ReputationService } from '../reputation/reputation.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { VerificationStatus, ApplicationStatus, TaskStatus } from '@prisma/client';

@Injectable()
export class SubmissionsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AIService,
    private walletService: WalletService,
    private reputationService: ReputationService,
  ) {}

  async createSubmission(userId: string, createSubmissionDto: CreateSubmissionDto) {
    const { taskId, applicationId, proofType, proofUrl, notes } = createSubmissionDto;

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
        proofType,
        proofUrl,
        submissionText: notes,
        verificationStatus: VerificationStatus.PENDING,
      },
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
    const submission = await this.prisma.taskSubmission.findUnique({
      where: { id },
      include: { task: true },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    await this.prisma.taskSubmission.update({
      where: { id },
      data: {
        verificationStatus: VerificationStatus.VERIFIED,
        verifiedAt: new Date(),
      },
    });

    await this.prisma.adminAction.create({
      data: {
        adminId: adminUserId,
        actionType: 'OVERRIDE_VERIFICATION',
        targetTaskId: submission.taskId,
        reason: comment ?? 'Submission verified by admin',
      },
    });

    await this.processPayout(submission);

    return {
      message: 'Submission verified successfully',
      data: { submissionId: id, status: VerificationStatus.VERIFIED },
    };
  }

  async rejectSubmission(id: string, adminUserId: string, comment: string) {
    const submission = await this.prisma.taskSubmission.findUnique({
      where: { id },
      include: { task: true },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    await this.prisma.taskSubmission.update({
      where: { id },
      data: {
        verificationStatus: VerificationStatus.REJECTED,
      },
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

  async getSubmission(id: string, userId: string) {
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

    // Only creator or tasker can view
    if (
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
      const submissionText = submission.submissionText || submission.proofUrl;

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

  private async processPayout(submission: any) {
    const task = await this.prisma.task.findUnique({
      where: { id: submission.taskId },
    });

    if (!task) return;

    // Use the new budget field (single budget amount)
    const taskData = task as any;
    const totalBudget = Number(taskData.budget || 0);
    
    // For SINGLE tasks, the full budget goes to one contributor
    // For MULTI tasks, budget is split (for now, we'll use full amount - can be enhanced)
    const payoutAmount = totalBudget;
    const platformFeePercentage = Number(task.platformFeePercentage || 5);
    const platformFee = (payoutAmount * platformFeePercentage) / 100;
    const taskerAmount = payoutAmount - platformFee;

    // Credit tasker wallet
    await this.walletService.credit(
      submission.taskerId,
      taskerAmount,
      'TASK_PAYOUT',
      `Payout for task: ${task.title}`,
      { referenceId: submission.id, taskId: task.id, submissionId: submission.id },
    );

    // Increase reputation
    await this.reputationService.increaseReputation(
      submission.taskerId,
      5,
      'Task completed and verified',
    );

    // Create notification
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

