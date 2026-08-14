import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DiditService } from './didit.service';

describe('DiditService safety detection', () => {
  let service: DiditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiditService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'DIDIT_API_KEY') return 'test-key';
              if (key === 'DIDIT_WORKFLOW_ID_LIVENESS') return 'workflow-liveness';
              if (key === 'DIDIT_WORKFLOW_ID_KYC') return 'workflow-kyc';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(DiditService);
  });

  it('detects underage from id_verifications age', () => {
    expect(
      service.detectUnderage({
        id_verifications: [{ age: 16, status: 'Approved' }],
      }),
    ).toBe(true);
  });

  it('detects duplicate face from face_matches warnings', () => {
    expect(
      service.detectDuplicateFace({
        face_matches: [{ status: 'Declined', warnings: ['Duplicate face on blocklist'] }],
      }),
    ).toBe(true);
  });

  it('returns false for clean decision', () => {
    expect(
      service.detectUnderage({
        liveness_checks: [{ status: 'Approved' }],
      }),
    ).toBe(false);
    expect(
      service.detectDuplicateFace({
        liveness_checks: [{ status: 'Approved' }],
      }),
    ).toBe(false);
  });

  it('reports KYC workflow when configured', () => {
    expect(service.isKycEnabled()).toBe(true);
    expect(service.getWorkflowIdKyc()).toBe('workflow-kyc');
  });
});
