import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  UserStatus,
  VerificationProvider,
  VerificationStatus,
  VerificationType,
  Prisma,
} from '@pingme/db';
import { NOTIFICATION_TYPES } from '@pingme/shared';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.module';
import { DiditService, DiditWebhookPayload } from './didit.service';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly didit: DiditService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationService,
  ) {}

  isEnforcementEnabled(): boolean {
    return this.didit.isEnabled();
  }

  isKycEnforcementEnabled(): boolean {
    return this.didit.isKycEnabled();
  }

  async hasPassedLiveness(userId: string): Promise<boolean> {
    if (!this.isEnforcementEnabled()) {
      return true;
    }

    const passed = await this.prisma.verification.findFirst({
      where: {
        userId,
        type: VerificationType.liveness,
        status: VerificationStatus.passed,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { verifiedAt: 'desc' },
    });

    return !!passed;
  }

  async hasPassedIdVerification(userId: string): Promise<boolean> {
    if (!this.didit.isKycEnabled()) {
      return false;
    }

    const passed = await this.prisma.verification.findFirst({
      where: {
        userId,
        type: VerificationType.document,
        status: VerificationStatus.passed,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { verifiedAt: 'desc' },
    });

    return !!passed;
  }

  async getStatus(userId: string, syncPending = true): Promise<{
    success: true;
    data: {
      livenessVerified: boolean;
      idVerified: boolean;
      kycEnabled: boolean;
      enforcementEnabled: boolean;
      status: VerificationStatus | null;
      verificationUrl: string | null;
      rejectionReason: string | null;
      sessionId: string | null;
      idVerification: {
        status: VerificationStatus | null;
        verificationUrl: string | null;
        rejectionReason: string | null;
        sessionId: string | null;
      };
    };
  }> {
    const [livenessVerified, idVerified] = await Promise.all([
      this.hasPassedLiveness(userId),
      this.hasPassedIdVerification(userId),
    ]);

    const [livenessLatest, idLatest] = await Promise.all([
      this.prisma.verification.findFirst({
        where: {
          userId,
          type: VerificationType.liveness,
          provider: VerificationProvider.didit,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.verification.findFirst({
        where: {
          userId,
          type: VerificationType.document,
          provider: VerificationProvider.didit,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (syncPending) {
      if (
        livenessLatest?.status === VerificationStatus.pending &&
        livenessLatest.providerReference
      ) {
        await this.syncFromDidit(livenessLatest.providerReference, userId);
        return this.getStatus(userId, false);
      }

      if (idLatest?.status === VerificationStatus.pending && idLatest.providerReference) {
        await this.syncFromDidit(idLatest.providerReference, userId);
        return this.getStatus(userId, false);
      }
    }

    const livenessDetails = this.extractVerificationDetails(livenessLatest);
    const idDetails = this.extractVerificationDetails(idLatest);

    return {
      success: true,
      data: {
        livenessVerified,
        idVerified,
        kycEnabled: this.didit.isKycEnabled(),
        enforcementEnabled: this.isEnforcementEnabled(),
        status: livenessDetails.status,
        verificationUrl: livenessDetails.verificationUrl,
        rejectionReason: livenessDetails.rejectionReason,
        sessionId: livenessDetails.sessionId,
        idVerification: idDetails,
      },
    };
  }

  private extractVerificationDetails(
    latest: {
      status: VerificationStatus;
      providerReference: string | null;
      metadata: Prisma.JsonValue | null;
    } | null,
  ): {
    status: VerificationStatus | null;
    verificationUrl: string | null;
    rejectionReason: string | null;
    sessionId: string | null;
  } {
    let verificationUrl: string | null = null;
    let rejectionReason: string | null = null;

    if (latest?.status === VerificationStatus.pending && latest.metadata) {
      const metadata = latest.metadata as Record<string, unknown>;
      verificationUrl = typeof metadata.url === 'string' ? metadata.url : null;
    }

    if (latest?.status === VerificationStatus.failed && latest.metadata) {
      const metadata = latest.metadata as Record<string, unknown>;
      rejectionReason =
        typeof metadata.rejection_reason === 'string' ? metadata.rejection_reason : null;
    }

    return {
      status: latest?.status ?? null,
      verificationUrl,
      rejectionReason,
      sessionId: latest?.providerReference ?? null,
    };
  }

  async startKyc(userId: string, email?: string | null) {
    return this.startKycForUser(userId, email);
  }

  async start(userId: string, email?: string | null) {
    if (!this.didit.isEnabled()) {
      throw new ServiceUnavailableException(
        'Identity verification is not configured on this server',
      );
    }

    const existing = await this.prisma.verification.findFirst({
      where: {
        userId,
        type: VerificationType.liveness,
        provider: VerificationProvider.didit,
        status: VerificationStatus.pending,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing?.metadata) {
      const metadata = existing.metadata as Record<string, unknown>;
      const url = typeof metadata.url === 'string' ? metadata.url : null;
      if (url) {
        return {
          success: true,
          data: {
            verificationUrl: url,
            sessionId: existing.providerReference,
            status: existing.status,
            resumed: true,
          },
        };
      }
    }

    const session = await this.didit.createSession(userId, email);
    const metadata = {
      session_id: session.session_id,
      session_token: session.session_token ?? null,
      url: session.url,
      workflow_id: session.workflow_id,
      didit_status: session.status,
      started_at: new Date().toISOString(),
    };

    const verification = await this.prisma.verification.create({
      data: {
        userId,
        type: VerificationType.liveness,
        provider: VerificationProvider.didit,
        providerReference: session.session_id,
        status: VerificationStatus.pending,
        metadata,
      },
    });

    await this.audit.log({
      userId,
      action: 'verification.start',
      entityType: 'verification',
      entityId: verification.id,
      metadata: { provider: 'didit', sessionId: session.session_id },
    });

    return {
      success: true,
      data: {
        verificationUrl: session.url,
        sessionId: session.session_id,
        status: VerificationStatus.pending,
        resumed: false,
      },
    };
  }

  async startKycForUser(userId: string, email?: string | null) {
    if (!this.didit.isKycEnabled()) {
      throw new ServiceUnavailableException('ID verification for events is not configured on this server');
    }

    const livenessVerified = await this.hasPassedLiveness(userId);
    let workflowType: 'id' | 'kyc';
    try {
      workflowType = this.didit.resolveEventHostWorkflow(livenessVerified);
    } catch {
      throw new ServiceUnavailableException('ID verification for events is not configured on this server');
    }

    const existing = await this.prisma.verification.findFirst({
      where: {
        userId,
        type: VerificationType.document,
        provider: VerificationProvider.didit,
        status: VerificationStatus.pending,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing?.metadata) {
      const metadata = existing.metadata as Record<string, unknown>;
      const existingWorkflowType =
        metadata.workflow_type === 'id' || metadata.workflow_type === 'kyc'
          ? metadata.workflow_type
          : null;
      const url = typeof metadata.url === 'string' ? metadata.url : null;

      if (url && (!existingWorkflowType || existingWorkflowType === workflowType)) {
        return {
          success: true,
          data: {
            verificationUrl: url,
            sessionId: existing.providerReference,
            status: existing.status,
            resumed: true,
          },
        };
      }

      if (!url && existing.providerReference) {
        await this.syncFromDidit(existing.providerReference, userId);
        const refreshed = await this.prisma.verification.findUnique({
          where: { id: existing.id },
        });
        if (refreshed?.metadata) {
          const refreshedMeta = refreshed.metadata as Record<string, unknown>;
          const refreshedUrl = typeof refreshedMeta.url === 'string' ? refreshedMeta.url : null;
          const refreshedWorkflowType =
            refreshedMeta.workflow_type === 'id' || refreshedMeta.workflow_type === 'kyc'
              ? refreshedMeta.workflow_type
              : null;
          if (
            refreshedUrl &&
            (!refreshedWorkflowType || refreshedWorkflowType === workflowType) &&
            refreshed.status === VerificationStatus.pending
          ) {
            return {
              success: true,
              data: {
                verificationUrl: refreshedUrl,
                sessionId: refreshed.providerReference,
                status: refreshed.status,
                resumed: true,
              },
            };
          }
        }
      }

      if (existing) {
        await this.prisma.verification.update({
          where: { id: existing.id },
          data: {
            status: VerificationStatus.expired,
            metadata: {
              ...metadata,
              superseded_at: new Date().toISOString(),
              superseded_reason: existingWorkflowType
                ? `Expected ${workflowType} workflow`
                : 'Could not resume pending session',
            },
          },
        });
      }
    } else if (existing) {
      await this.prisma.verification.update({
        where: { id: existing.id },
        data: {
          status: VerificationStatus.expired,
          metadata: {
            superseded_at: new Date().toISOString(),
            superseded_reason: 'Missing session metadata',
          },
        },
      });
    }

    const session = await this.didit.createSession(userId, email, workflowType);
    const metadata = {
      session_id: session.session_id,
      session_token: session.session_token ?? null,
      url: session.url,
      workflow_id: session.workflow_id,
      workflow_type: workflowType,
      didit_status: session.status,
      started_at: new Date().toISOString(),
    };

    const verification = await this.prisma.verification.create({
      data: {
        userId,
        type: VerificationType.document,
        provider: VerificationProvider.didit,
        providerReference: session.session_id,
        status: VerificationStatus.pending,
        metadata,
      },
    });

    await this.audit.log({
      userId,
      action: 'verification.kyc_start',
      entityType: 'verification',
      entityId: verification.id,
      metadata: { provider: 'didit', sessionId: session.session_id },
    });

    return {
      success: true,
      data: {
        verificationUrl: session.url,
        sessionId: session.session_id,
        status: VerificationStatus.pending,
        resumed: false,
      },
    };
  }

  async handleWebhook(payload: DiditWebhookPayload, headers: Record<string, string | string[] | undefined>) {
    if (!this.didit.isEnabled()) {
      return { success: false, message: 'Verification disabled' };
    }

    if (!this.didit.verifyWebhookSignature(headers, payload as Record<string, unknown>)) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    const eventType = payload.webhook_type;
    if (!eventType || !this.didit.isSubscribedEvent(eventType)) {
      return { success: true, ignored: true };
    }

    if (payload.event_id) {
      const cacheKey = `didit:webhook:${payload.event_id}`;
      const claimed = await this.redis.client.set(cacheKey, '1', 'EX', 7 * 24 * 60 * 60, 'NX');
      if (claimed !== 'OK') {
        return { success: true, duplicate: true };
      }
    }

    const sessionId = payload.session_id;
    const vendorData = payload.vendor_data;

    let verification = sessionId
      ? await this.prisma.verification.findFirst({
          where: { providerReference: sessionId },
        })
      : null;

    if (!verification && vendorData) {
      verification = await this.prisma.verification.findFirst({
        where: {
          userId: vendorData,
          provider: VerificationProvider.didit,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!verification) {
      this.logger.warn('Didit webhook could not match verification record', {
        sessionId,
        vendorData,
      });
      return { success: false, message: 'Verification not found' };
    }

    await this.applyDiditResult(verification.id, verification.userId, payload);

    return { success: true };
  }

  private async syncFromDidit(sessionId: string, userId: string) {
    const decision = await this.didit.fetchDecision(sessionId);
    if (!decision) return;

    const verification = await this.prisma.verification.findFirst({
      where: { userId, providerReference: sessionId },
    });
    if (!verification) return;

    await this.applyDiditResult(verification.id, userId, {
      session_id: sessionId,
      status: typeof decision.status === 'string' ? decision.status : undefined,
      decision,
    });
  }

  private async applyDiditResult(
    verificationId: string,
    userId: string,
    payload: DiditWebhookPayload,
  ) {
    const sessionId = payload.session_id;
    const localStatus = this.didit.mapStatusToLocal(payload.status);
    if (!localStatus) return;

    const existing = await this.prisma.verification.findUnique({ where: { id: verificationId } });
    const decision = payload.decision ?? null;
    const isDocument = existing?.type === VerificationType.document;
    const workflowType =
      isDocument && existing?.metadata && typeof existing.metadata === 'object'
        ? ((existing.metadata as Record<string, unknown>).workflow_type as 'id' | 'kyc' | undefined) ??
          'kyc'
        : undefined;
    const approved = isDocument
      ? this.didit.isDocumentVerificationApproved(
          decision ?? { status: payload.status },
          workflowType ?? 'kyc',
        )
      : this.didit.isLivenessApproved(decision ?? { status: payload.status });

    let finalStatus = localStatus;
    if (localStatus === 'passed' && !approved) {
      finalStatus = 'failed';
    }
    if (localStatus === 'pending' && approved) {
      finalStatus = 'passed';
    }

    const rejectionReason =
      finalStatus === 'failed' ? this.didit.extractRejectionReason(payload) : null;

    const metadata = {
      ...(typeof existing?.metadata === 'object' && existing.metadata !== null
        ? (existing.metadata as Record<string, unknown>)
        : {}),
      last_webhook: {
        status: payload.status,
        webhook_type: payload.webhook_type,
        received_at: new Date().toISOString(),
      },
      decision,
      rejection_reason: rejectionReason,
    } as Prisma.InputJsonValue;

    const updated = await this.prisma.verification.update({
      where: { id: verificationId },
      data: {
        providerReference: sessionId ?? existing?.providerReference,
        status:
          finalStatus === 'passed'
            ? VerificationStatus.passed
            : finalStatus === 'failed'
              ? VerificationStatus.failed
              : VerificationStatus.pending,
        metadata,
        verifiedAt: finalStatus === 'passed' ? new Date() : null,
      },
    });

    if (finalStatus === 'passed' && existing?.status !== VerificationStatus.passed) {
      if (isDocument && workflowType === 'kyc') {
        await this.ensureLivenessPassedFromCombinedSession(userId, sessionId, metadata);
      }

      await this.audit.log({
        userId,
        action: isDocument ? 'verification.kyc_passed' : 'verification.passed',
        entityType: 'verification',
        entityId: updated.id,
        metadata: { provider: 'didit', sessionId, type: updated.type, workflowType },
      });

      await this.notifications.sendToUser(userId, {
        type: NOTIFICATION_TYPES.VERIFICATION_PASSED,
        title: isDocument ? 'ID verified' : "You're verified",
        body: isDocument
          ? 'Your ID check passed. You can host events.'
          : 'Liveness check complete — you can post, chat, and break the ice.',
        data: {
          type: NOTIFICATION_TYPES.VERIFICATION_PASSED,
          verificationType: isDocument ? 'kyc' : 'liveness',
        },
      });
    }

    if (finalStatus === 'failed' && existing?.status !== VerificationStatus.failed) {
      await this.audit.log({
        userId,
        action: 'verification.failed',
        entityType: 'verification',
        entityId: updated.id,
        metadata: { provider: 'didit', sessionId, reason: rejectionReason },
      });
    }

    await this.applySafetyActions(userId, decision, finalStatus);
  }

  private async ensureLivenessPassedFromCombinedSession(
    userId: string,
    sessionId: string | undefined,
    sourceMetadata: Prisma.InputJsonValue,
  ) {
    const alreadyPassed = await this.hasPassedLiveness(userId);
    if (alreadyPassed) {
      return;
    }

    await this.prisma.verification.create({
      data: {
        userId,
        type: VerificationType.liveness,
        provider: VerificationProvider.didit,
        providerReference: sessionId ?? null,
        status: VerificationStatus.passed,
        verifiedAt: new Date(),
        metadata: {
          ...(typeof sourceMetadata === 'object' && sourceMetadata !== null
            ? (sourceMetadata as Record<string, unknown>)
            : {}),
          source: 'combined_liveness_and_id_session',
        },
      },
    });
  }

  private async applySafetyActions(
    userId: string,
    decision: Record<string, unknown> | null | undefined,
    finalStatus: 'pending' | 'passed' | 'failed',
  ) {
    if (!decision) return;

    if (this.didit.detectUnderage(decision)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.suspended,
          requiresAdminReview: true,
          isAvailable: false,
        },
      });

      await this.audit.log({
        userId,
        action: 'verification.underage_suspend',
        entityType: 'user',
        entityId: userId,
        metadata: { source: 'didit' },
      });
      return;
    }

    if (this.didit.detectDuplicateFace(decision)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { requiresAdminReview: true },
      });

      await this.audit.log({
        userId,
        action: 'verification.duplicate_face_flag',
        entityType: 'user',
        entityId: userId,
        metadata: { source: 'didit', status: finalStatus },
      });
    }
  }

  assertLivenessRequired() {
    if (!this.isEnforcementEnabled()) return;
    throw new BadRequestException({
      code: 'LIVENESS_REQUIRED',
      message: 'Complete liveness verification to use this feature',
    });
  }
}
