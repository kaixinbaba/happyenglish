// Use Cloudflare R2 S3-compatible API with manual AWS Signature V4 signing
// Avoids @aws-sdk/client-s3 which uses fs.readFile (not available in CF Workers)

export async function uploadImage(key: string, buffer: ArrayBuffer): Promise<string> {
  const accountId = process.env.R2_ACCOUNT_ID!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
  const bucketName = process.env.R2_BUCKET_NAME || 'happyenglish-images';

  const region = 'auto';
  const service = 's3';
  const method = 'PUT';
  const host = `${accountId}.r2.cloudflarestorage.com`;
  // URI-encode each path segment
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const canonicalUri = `/${bucketName}/${encodedKey}`;
  const url = `https://${host}${canonicalUri}`;

  const now = new Date();
  const datestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const date = datestamp.substring(0, 8);

  const credentialScope = `${date}/${region}/${service}/aws4_request`;

  const payloadHash = await sha256Hex(buffer);

  const canonicalHeaders = [
    `content-type:image/webp`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${datestamp}`,
  ].join('\n') + '\n';

  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = `${method}\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datestamp,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await getSignatureKey(secretAccessKey, date, region, service);
  const signature = await hmacSha256Hex(signingKey, stringToSign);

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/webp',
      'Host': host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': datestamp,
      'Authorization': authorizationHeader,
    },
    body: buffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`R2 upload failed: ${response.status} ${errorText}`);
  }

  return `https://${process.env.R2_PUBLIC_DOMAIN}/${key}`;
}

async function getSignatureKey(secretKey: string, date: string, region: string, service: string): Promise<ArrayBuffer> {
  let key = await hmacSha256Raw(`AWS4${secretKey}`, date);
  key = await hmacSha256Raw(key, region);
  key = await hmacSha256Raw(key, service);
  key = await hmacSha256Raw(key, 'aws4_request');
  return key;
}

async function sha256Hex(data: string | ArrayBuffer): Promise<string> {
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Raw(key: string | ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : new Uint8Array(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function hmacSha256Hex(key: string | ArrayBuffer, data: string): Promise<string> {
  const sig = await hmacSha256Raw(key, data);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}
