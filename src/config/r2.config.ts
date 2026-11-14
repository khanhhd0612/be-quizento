import { registerAs } from '@nestjs/config';

export default registerAs('r2', () => {
  const accountId = process.env.R2_ACCOUNT_ID || '';
  const endpoint =
    process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  return {
    accountId,
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.R2_BUCKET_NAME || '',
    publicUrl: (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, ''),
    endpoint,
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE ?? '5242880', 10), // 5MB mặc định
  };
});
