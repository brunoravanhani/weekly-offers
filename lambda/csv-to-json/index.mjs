import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

const s3 = new S3Client({});

const processedBucket = process.env.PROCESSED_BUCKET;
const outputPrefix = process.env.OUTPUT_PREFIX || "data/processed";
const catalogKey = process.env.CATALOG_KEY || "data/catalog/index.json";
const catalogLookbackDays = Number(process.env.CATALOG_LOOKBACK_DAYS || "7");

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(value.trim());
      value = "";
      continue;
    }

    value += char;
  }

  cells.push(value.trim());
  return cells;
}

function parseCurrencyNumber(raw) {
  if (!raw) return null;
  const normalized = raw
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/\s/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercentage(raw) {
  if (!raw) return null;
  const normalized = raw.replace("%", "").replace(/,/g, ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildFileTimestamp(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function normalizePrefix(prefix) {
  return prefix.replace(/^\/+/, "").replace(/\/+$/, "");
}

function parseTimestampFromProcessedKey(key, processedPrefix) {
  const normalizedPrefix = normalizePrefix(processedPrefix);
  const expectedPrefix = `${normalizedPrefix}/`;

  if (!key.startsWith(expectedPrefix)) {
    return null;
  }

  const fileName = key.slice(expectedPrefix.length);
  const match = fileName.match(/^(\d{8})-(\d{6})\.json$/);
  if (!match) {
    return null;
  }

  const [, datePart, timePart] = match;
  const year = Number(datePart.slice(0, 4));
  const month = Number(datePart.slice(4, 6));
  const day = Number(datePart.slice(6, 8));
  const hours = Number(timePart.slice(0, 2));
  const minutes = Number(timePart.slice(2, 4));
  const seconds = Number(timePart.slice(4, 6));

  return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
}

function mapRow(headers, row) {
  const item = {};
  headers.forEach((header, index) => {
    item[header] = row[index] ?? "";
  });

  return {
    itemId: item["Item Id"],
    itemName: item["Item Name"],
    price: parseCurrencyNumber(item["Price"]),
    priceRaw: item["Price"],
    sales: item["Sales"],
    shopName: item["Shop Name"],
    commissionRate: parsePercentage(item["Commission Rate"]),
    commissionRateRaw: item["Commission Rate"],
    commission: parseCurrencyNumber(item["Commission"]),
    commissionRaw: item["Commission"],
    productLink: item["Product Link"],
    offerLink: item["Offer Link"],
    image: item["Image"]
  };
}

async function readJsonObject(bucket, key) {
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key
      })
    );

    const content = await streamToString(response.Body);
    return JSON.parse(content);
  } catch (error) {
    if (error.name === "NoSuchKey") {
      return null;
    }
    if (error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
}

async function listProcessedJsonObjects(bucket, processedPrefix) {
  const normalizedPrefix = `${normalizePrefix(processedPrefix)}/`;
  const objects = [];
  let continuationToken;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: normalizedPrefix,
        ContinuationToken: continuationToken
      })
    );

    for (const item of response.Contents || []) {
      if (item.Key && item.Key.endsWith(".json")) {
        objects.push({
          key: item.Key,
          lastModified: item.LastModified ?? null
        });
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}

async function rebuildCatalogIndex(bucket) {
  const now = new Date();
  const lookbackDays = Number.isFinite(catalogLookbackDays) && catalogLookbackDays > 0 ? catalogLookbackDays : 7;
  const cutoffDate = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const processedObjects = await listProcessedJsonObjects(bucket, outputPrefix);

  const filteredObjects = processedObjects
    .map((objectInfo) => {
      const fileDate = parseTimestampFromProcessedKey(objectInfo.key, outputPrefix);
      return {
        ...objectInfo,
        fileDate
      };
    })
    .filter((objectInfo) => objectInfo.fileDate && objectInfo.fileDate >= cutoffDate)
    .sort((a, b) => b.fileDate.getTime() - a.fileDate.getTime());

  const processedFiles = [];
  const catalogItems = [];

  for (const objectInfo of filteredObjects) {
    const parsed = await readJsonObject(bucket, objectInfo.key);
    if (!parsed || !Array.isArray(parsed.items)) {
      continue;
    }

    const source = parsed.source || { bucket, key: objectInfo.key };
    const generatedAt = parsed.generatedAt || objectInfo.fileDate.toISOString();
    const itemCount = Number.isFinite(parsed.itemCount) ? parsed.itemCount : parsed.items.length;

    processedFiles.push({
      jsonKey: objectInfo.key,
      source,
      generatedAt,
      itemCount
    });

    for (const item of parsed.items) {
      catalogItems.push({
        ...item,
        sourceJsonKey: objectInfo.key,
        sourceGeneratedAt: generatedAt
      });
    }
  }

  const payload = {
    updatedAt: now.toISOString(),
    lookbackDays,
    cutoffAt: cutoffDate.toISOString(),
    fileCount: processedFiles.length,
    itemCount: catalogItems.length,
    files: processedFiles,
    items: catalogItems
  };

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: catalogKey,
      Body: JSON.stringify(payload, null, 2),
      ContentType: "application/json"
    })
  );
}

export async function handler(event) {
  if (!processedBucket) {
    throw new Error("PROCESSED_BUCKET environment variable is required");
  }

  for (const record of event.Records || []) {
    const inputBucket = record.s3.bucket.name;
    const inputKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    const csvObject = await s3.send(
      new GetObjectCommand({
        Bucket: inputBucket,
        Key: inputKey
      })
    );

    const csvContent = await streamToString(csvObject.Body);
    const rows = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);

    if (rows.length < 2) {
      console.log(`Skipping ${inputKey} because it has no data rows`);
      continue;
    }

    const headers = parseCsvLine(rows[0]);
    const records = rows.slice(1).map((line) => mapRow(headers, parseCsvLine(line)));

    const fileTimestamp = buildFileTimestamp();
    const outputKey = `${outputPrefix}/${fileTimestamp}.json`;

    await s3.send(
      new PutObjectCommand({
        Bucket: processedBucket,
        Key: outputKey,
        Body: JSON.stringify(
          {
            source: {
              bucket: inputBucket,
              key: inputKey
            },
            generatedAt: new Date().toISOString(),
            itemCount: records.length,
            items: records
          },
          null,
          2
        ),
        ContentType: "application/json"
      })
    );

    await rebuildCatalogIndex(processedBucket);

    console.log(`Processed ${inputKey} into ${processedBucket}/${outputKey}`);
  }
}
