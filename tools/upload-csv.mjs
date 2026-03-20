#!/usr/bin/env node
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";
import path from "node:path";

const [, , filePath, bucketName, optionalKey] = process.argv;

if (!filePath || !bucketName) {
  console.error("Usage: node tools/upload-csv.mjs <local_csv_path> <bucket_name> [object_key]");
  process.exit(1);
}

const client = new S3Client({});

async function main() {
  const body = await readFile(filePath);
  const objectKey = optionalKey || `uploads/${Date.now()}-${path.basename(filePath)}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: body,
      ContentType: "text/csv"
    })
  );

  console.log(`Uploaded ${filePath} to s3://${bucketName}/${objectKey}`);
}

main().catch((error) => {
  console.error("Failed to upload CSV:", error);
  process.exit(1);
});
