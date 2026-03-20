import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

const s3 = new S3Client({});

const processedBucket = process.env.PROCESSED_BUCKET;
const outputPrefix = process.env.OUTPUT_PREFIX || "data/processed";
const catalogKey = process.env.CATALOG_KEY || "data/catalog/index.json";

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
    offerLink: item["Offer Link"]
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

    const baseFileName = inputKey.split("/").pop().replace(/\.csv$/i, "");
    const outputKey = `${outputPrefix}/${baseFileName}.json`;

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

    const existingCatalog = (await readJsonObject(processedBucket, catalogKey)) || {
      updatedAt: null,
      files: []
    };

    const nowIso = new Date().toISOString();
    const entry = {
      sourceKey: inputKey,
      jsonKey: outputKey,
      itemCount: records.length,
      updatedAt: nowIso
    };

    const withoutCurrent = existingCatalog.files.filter((file) => file.sourceKey !== inputKey);
    const updatedCatalog = {
      updatedAt: nowIso,
      files: [entry, ...withoutCurrent].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    };

    await s3.send(
      new PutObjectCommand({
        Bucket: processedBucket,
        Key: catalogKey,
        Body: JSON.stringify(updatedCatalog, null, 2),
        ContentType: "application/json"
      })
    );

    console.log(`Processed ${inputKey} into ${processedBucket}/${outputKey}`);
  }
}
