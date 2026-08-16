import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyDiditSignatureSimple, verifyDiditSignatureV2 } from './didit-signature.util';

export interface DiditSessionResponse {
  session_id: string;
  session_token?: string;
  url: string;
  status: string;
  workflow_id: string;
  vendor_data?: string;
}

export interface DiditWebhookPayload {
  webhook_type?: string;
  event_id?: string;
  session_id?: string;
  vendor_data?: string;
  status?: string;
  decision?: Record<string, unknown>;
  timestamp?: number | string;
}

@Injectable()
export class DiditService implements OnModuleInit {
  private readonly logger = new Logger(DiditService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (this.isEnabled()) {
      this.logger.log('Didit liveness verification is enabled');
    } else {
      this.logger.warn('Didit liveness verification is disabled (missing API key or liveness workflow)');
    }

    if (this.isKycEnabled()) {
      this.logger.log('Didit ID verification is enabled for event hosts');
    } else if (this.isEnabled()) {
      this.logger.warn(
        'Event host ID verification is not configured — set DIDIT_WORKFLOW_ID_ID and/or DIDIT_WORKFLOW_ID_KYC',
      );
    }
  }

  isEnabled(): boolean {
    return (
      !!this.config.get('DIDIT_API_KEY') &&
      !!this.config.get('DIDIT_WORKFLOW_ID_LIVENESS')
    );
  }

  getWorkflowIdLiveness(): string {
    return this.config.get<string>('DIDIT_WORKFLOW_ID_LIVENESS', '');
  }

  getWorkflowIdId(): string | null {
    const workflowId = this.config.get<string>('DIDIT_WORKFLOW_ID_ID');
    return workflowId || null;
  }

  getWorkflowIdKyc(): string | null {
    const workflowId = this.config.get<string>('DIDIT_WORKFLOW_ID_KYC');
    return workflowId || null;
  }

  /** Combined liveness + ID — used when the user has not passed liveness yet. */
  getWorkflowIdLivenessAndId(): string | null {
    return this.getWorkflowIdKyc();
  }

  isKycEnabled(): boolean {
    return this.isEnabled() && (!!this.getWorkflowIdId() || !!this.getWorkflowIdKyc());
  }

  resolveEventHostWorkflow(hasPassedLiveness: boolean): 'id' | 'kyc' {
    if (hasPassedLiveness && this.getWorkflowIdId()) {
      return 'id';
    }
    if (this.getWorkflowIdKyc()) {
      return 'kyc';
    }
    if (this.getWorkflowIdId()) {
      throw new Error('ID-only workflow requires liveness verification first');
    }
    throw new Error('Event host verification workflows are not configured');
  }

  private getBaseUrl(): string {
    return this.config.get<string>(
      'DIDIT_API_BASE_URL',
      'https://verification.didit.me/v3',
    ).replace(/\/$/, '');
  }

  async createSession(
    userId: string,
    email?: string | null,
    workflowType: 'liveness' | 'id' | 'kyc' = 'liveness',
  ): Promise<DiditSessionResponse> {
    const apiKey = this.config.get<string>('DIDIT_API_KEY');
    const workflowId =
      workflowType === 'liveness'
        ? this.getWorkflowIdLiveness()
        : workflowType === 'id'
          ? this.getWorkflowIdId()
          : this.getWorkflowIdKyc();

    if (!workflowId) {
      throw new Error(
        workflowType === 'liveness'
          ? 'Liveness workflow is not configured'
          : workflowType === 'id'
            ? 'ID-only workflow is not configured'
            : 'Liveness + ID workflow is not configured',
      );
    }
    const callback =
      this.config.get<string>('DIDIT_CALLBACK_URL') ?? 'pingme://verification-complete';

    const response = await fetch(`${this.getBaseUrl()}/session/`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey!,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        vendor_data: userId,
        callback,
        metadata: { user_id: userId, email: email ?? undefined, workflow_type: workflowType },
      }),
    });

    const body = (await response.json().catch(() => ({}))) as DiditSessionResponse & {
      detail?: string;
    };

    if (!response.ok) {
      this.logger.error('Didit session creation failed', {
        userId,
        status: response.status,
        body,
      });
      throw new Error(body.detail ?? 'Failed to create Didit verification session');
    }

    return body;
  }

  async fetchDecision(sessionId: string): Promise<Record<string, unknown> | null> {
    const apiKey = this.config.get<string>('DIDIT_API_KEY');
    const response = await fetch(`${this.getBaseUrl()}/session/${sessionId}/decision/`, {
      headers: {
        'x-api-key': apiKey!,
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      this.logger.warn('Didit decision fetch failed', { sessionId, status: response.status });
      return null;
    }

    return (await response.json()) as Record<string, unknown>;
  }

  isSubscribedEvent(eventType: string): boolean {
    const configured = this.config.get<string>('DIDIT_WEBHOOK_EVENTS', '');
    if (!configured) {
      return ['status.updated', 'data.updated'].includes(eventType);
    }
    return configured.split(',').map((e) => e.trim()).includes(eventType);
  }

  verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    body: Record<string, unknown>,
  ): boolean {
    const secret = this.config.get<string>('DIDIT_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn('Didit webhook received but DIDIT_WEBHOOK_SECRET is not set');
      return false;
    }

    const timestamp = String(headers['x-timestamp'] ?? '');
    if (!timestamp) return false;

    const sigV2 = String(headers['x-signature-v2'] ?? '');
    if (sigV2 && verifyDiditSignatureV2(body, sigV2, timestamp, secret)) {
      return true;
    }

    const sigSimple = String(headers['x-signature-simple'] ?? '');
    if (sigSimple && verifyDiditSignatureSimple(body, sigSimple, timestamp, secret)) {
      return true;
    }

    return false;
  }

  mapStatusToLocal(diditStatus?: string | null): 'pending' | 'passed' | 'failed' | null {
    switch (diditStatus) {
      case 'Approved':
        return 'passed';
      case 'Declined':
      case 'Abandoned':
      case 'Expired':
      case 'Kyc Expired':
        return 'failed';
      case 'In Review':
      case 'Resubmitted':
      case 'Not Started':
      case 'In Progress':
      case 'Awaiting User':
        return 'pending';
      default:
        return null;
    }
  }

  isLivenessApproved(decision: Record<string, unknown> | null | undefined): boolean {
    if (!decision) return false;

    const checks = decision.liveness_checks;
    if (!Array.isArray(checks) || checks.length === 0) {
      return decision.status === 'Approved';
    }

    return checks.some(
      (check) =>
        check &&
        typeof check === 'object' &&
        (check as { status?: string }).status === 'Approved',
    );
  }

  isIdApproved(decision: Record<string, unknown> | null | undefined): boolean {
    if (!decision) return false;

    const idVerifications = decision.id_verifications;
    return (
      Array.isArray(idVerifications) &&
      idVerifications.some(
        (item) =>
          item &&
          typeof item === 'object' &&
          (item as { status?: string }).status === 'Approved',
      )
    );
  }

  isKycApproved(decision: Record<string, unknown> | null | undefined): boolean {
    if (!this.isIdApproved(decision)) {
      return false;
    }

    return this.isLivenessApproved(decision);
  }

  isDocumentVerificationApproved(
    decision: Record<string, unknown> | null | undefined,
    workflowType: 'id' | 'kyc',
  ): boolean {
    if (workflowType === 'id') {
      return this.isIdApproved(decision);
    }

    return this.isKycApproved(decision);
  }

  extractRejectionReason(payload: DiditWebhookPayload): string | null {
    const decision = payload.decision;
    if (!decision || typeof decision !== 'object') {
      return payload.status === 'Declined' ? 'Verification was declined' : null;
    }

    const warnings: string[] = [];
    for (const section of ['id_verifications', 'liveness_checks', 'face_matches'] as const) {
      const items = decision[section];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const itemWarnings = (item as { warnings?: unknown[] }).warnings;
        if (!Array.isArray(itemWarnings)) continue;
        for (const warning of itemWarnings) {
          if (typeof warning === 'string') warnings.push(warning);
          else if (warning && typeof warning === 'object' && 'message' in warning) {
            warnings.push(String((warning as { message: string }).message));
          }
        }
      }
    }

    if (warnings.length > 0) {
      return [...new Set(warnings)].join('; ');
    }

    return payload.status === 'Declined' ? 'Verification was declined' : null;
  }

  detectUnderage(decision: Record<string, unknown> | null | undefined): boolean {
    if (!decision) return false;

    const idVerifications = decision.id_verifications;
    if (!Array.isArray(idVerifications)) return false;

    for (const item of idVerifications) {
      if (!item || typeof item !== 'object') continue;
      const age = (item as { age?: number | string }).age;
      if (typeof age === 'number' && age < 18) return true;
      if (typeof age === 'string' && Number.parseInt(age, 10) < 18) return true;
      const status = (item as { status?: string }).status;
      if (status === 'Underage') return true;
    }

    const warnings = this.collectWarnings(decision);
    return warnings.some((warning) => /under\s*age|minor|below\s*18/i.test(warning));
  }

  detectDuplicateFace(decision: Record<string, unknown> | null | undefined): boolean {
    if (!decision) return false;

    const faceMatches = decision.face_matches;
    if (!Array.isArray(faceMatches)) return false;

    for (const item of faceMatches) {
      if (!item || typeof item !== 'object') continue;
      const status = (item as { status?: string }).status;
      if (status === 'Declined' || status === 'Rejected') return true;
      const warnings = (item as { warnings?: unknown[] }).warnings;
      if (!Array.isArray(warnings)) continue;
      for (const warning of warnings) {
        const text =
          typeof warning === 'string'
            ? warning
            : warning && typeof warning === 'object' && 'message' in warning
              ? String((warning as { message: string }).message)
              : '';
        if (/duplicate|blocklist|face\s*match/i.test(text)) return true;
      }
    }

    return this.collectWarnings(decision).some((warning) =>
      /duplicate|blocklist|face\s*match/i.test(warning),
    );
  }

  private collectWarnings(decision: Record<string, unknown>): string[] {
    const warnings: string[] = [];
    for (const section of ['id_verifications', 'liveness_checks', 'face_matches'] as const) {
      const items = decision[section];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const itemWarnings = (item as { warnings?: unknown[] }).warnings;
        if (!Array.isArray(itemWarnings)) continue;
        for (const warning of itemWarnings) {
          if (typeof warning === 'string') warnings.push(warning);
          else if (warning && typeof warning === 'object' && 'message' in warning) {
            warnings.push(String((warning as { message: string }).message));
          }
        }
      }
    }
    return warnings;
  }
}
