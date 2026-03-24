import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

export async function uploadImage(key: string, buffer: ArrayBuffer): Promise<string> {
  const client = getS3Client();

  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME || 'happyenglish-images',
    Key: key,
    Body: new Uint8Array(buffer),
    ContentType: 'image/webp',
  }));

  return `https://${process.env.R2_PUBLIC_DOMAIN}/${key}`;
}
