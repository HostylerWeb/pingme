import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

  async createPresignedUpload(key: string, contentType: string) {
    if (!this.isConfigured()) {
      return {
        uploadUrl: null as string | null,
        key,
        contentType,
        message: 'R2 not configured — set R2_* env vars for avatar uploads',
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

  getPublicUrl(key: string) {
    const base = this.config.get<string>('R2_PUBLIC_URL', 'https://cdn.example.com');
    return `${base.replace(/\/$/, '')}/${key}`;
  }
}
