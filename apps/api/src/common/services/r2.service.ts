import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, resolve, sep } from 'path';

export type PresignResult = {
  uploadUrl: string | null;
  key: string;
  contentType: string;
  directUpload?: boolean;
  message?: string;
};

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(
      this.config.get('R2_ACCOUNT_ID') &&
        this.config.get('R2_ACCESS_KEY_ID') &&
        this.config.get('R2_SECRET_ACCESS_KEY') &&
        this.config.get('R2_BUCKET_AVATARS'),
    );
  }

  private getUploadsDir() {
    return this.config.get<string>('UPLOADS_DIR', 'uploads');
  }

  getApiPublicBaseUrl() {
    return this.config.get<string>('API_PUBLIC_URL', 'http://localhost:3000/v1').replace(/\/$/, '');
  }

  private getClient() {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID')!;
    return new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID')!,
        secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY')!,
      },
    });
  }

  async createPresignedUpload(key: string, contentType: string): Promise<PresignResult> {
    if (!this.isConfigured()) {
      this.logger.warn('R2 not configured — using direct upload fallback');
      return {
        uploadUrl: null,
        key,
        contentType,
        directUpload: true,
      };
    }

    const bucket = this.config.get<string>('R2_BUCKET_AVATARS')!;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.getClient(), command, { expiresIn: 900 });
    this.logger.log(`Presigned upload URL created for ${key}`);
    return { uploadUrl, key, contentType };
  }

  async saveLocalFile(key: string, buffer: Buffer): Promise<string> {
    const uploadsRoot = resolve(process.cwd(), this.getUploadsDir());
    const filePath = resolve(uploadsRoot, key);
    if (filePath !== uploadsRoot && !filePath.startsWith(uploadsRoot + sep)) {
      throw new BadRequestException('Invalid upload path');
    }
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
    return this.getLocalPublicUrl(key);
  }

  getLocalPublicUrl(key: string) {
    return `${this.getApiPublicBaseUrl()}/uploads/${key}`;
  }

  getPublicUrl(key: string) {
    if (!this.isConfigured()) {
      return this.getLocalPublicUrl(key);
    }
    const base = this.config.get<string>('R2_PUBLIC_URL', 'https://cdn.example.com');
    return `${base.replace(/\/$/, '')}/${key}`;
  }
}
