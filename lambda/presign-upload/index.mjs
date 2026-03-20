import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({});
const uploadBucket = process.env.UPLOAD_BUCKET;
const defaultPrefix = process.env.UPLOAD_PREFIX || "uploads";
const expiresInSeconds = Number(process.env.URL_EXPIRATION_SECONDS || 300);

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "access-control-allow-headers": "content-type"
    },
    body: JSON.stringify(body)
  };
}

function sanitizeFileName(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function handler(event) {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return response(200, { ok: true });
  }

  if (!uploadBucket) {
    return response(500, { message: "UPLOAD_BUCKET is not configured" });
  }

  const query = event.queryStringParameters || {};
  const fileName = query.fileName;

  if (!fileName || !fileName.toLowerCase().endsWith(".csv")) {
    return response(400, { message: "fileName query parameter with .csv extension is required" });
  }

  const safeName = sanitizeFileName(fileName);
  const objectKey = `${defaultPrefix}/${Date.now()}-${safeName}`;

  const command = new PutObjectCommand({
    Bucket: uploadBucket,
    Key: objectKey,
    ContentType: "text/csv"
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });

  return response(200, {
    method: "PUT",
    uploadUrl,
    bucket: uploadBucket,
    key: objectKey,
    expiresInSeconds
  });
}
