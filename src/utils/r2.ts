import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import crypto from 'crypto';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

/**
 * Organização do bucket:
 *   {shopId}/services/{uniqueId}.{ext}
 *   {shopId}/professionals/{uniqueId}.{ext}
 *   {shopId}/shop/{uniqueId}.{ext}
 */

type UploadFolder = 'services' | 'professionals' | 'shop';

interface PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export async function generatePresignedUpload(
  shopId: string,
  folder: UploadFolder,
  contentType: string,
): Promise<PresignedUpload> {
  const ext = contentType.split('/')[1] || 'bin';
  const uniqueId = crypto.randomUUID();
  const key = `${shopId}/${folder}/${uniqueId}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
  const publicUrl = `${env.R2_PUBLIC_URL}/${key}`;

  return { uploadUrl, publicUrl, key };
}
