import { Injectable, Logger } from '@nestjs/common';
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
export class DiditService {
  private readonly logger = new Logger(DiditService.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return (
      !!this.config.get('DIDIT_API_KEY') &&
      !!this.config.get('DIDIT_WORKFLOW_ID_LIVENESS')
    );
  }

  getWorkflowIdLiveness(): string {
    return this.config.get<string>('DIDIT_WORKFLOW_ID_LIVENESS', '');
  }

  private getBaseUrl(): string {
    return this.config.get<string>(
      'DIDIT_API_BASE_URL',
      'https://verification.didit.me/v3',
    ).replace(/\/$/, '');
  }

  async createSession(userId: string, email?: string | null): Promise<DiditSessionResponse> {
    const apiKey = this.config.get<string>('DIDIT_API_KEY');
    const workflowId = this.getWorkflowIdLiveness();
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
        metadata: { user_id: userId, email: email ?? undefined },
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
}
