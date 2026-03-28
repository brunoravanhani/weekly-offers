# Weekly Offers - AWS Pipeline + Catalog

This workspace includes:

- Terraform infrastructure for:
  - S3 bucket for raw CSV uploads
  - Lambda trigger on `.csv` upload
  - Lambda Function URL to generate presigned upload URLs
  - S3 bucket for processed JSON output
  - S3 bucket for static Next.js hosting
  - CloudFront distribution serving both site and data
  - Optional custom domain with ACM certificate + Route53 records
- Lambda (`Node.js`) that converts CSV rows into JSON files and updates a catalog index.
- Upload alternatives:
  - Node CLI to send CSV files to S3
  - Presigned URL API so clients can upload without AWS credentials
- Next.js static catalog app that reads processed JSON from CloudFront.
- GitHub Actions workflows for Terraform apply, Terraform destroy, and web deployment.

## 1) Deploy Infrastructure

Install Lambda dependencies first (Terraform packages local folders):

```bash
cd lambda/csv-to-json
npm install
cd ../presign-upload
npm install
cd ../../infra
```

Optional: if using custom domain, create `infra/terraform.tfvars`:

```hcl
custom_domain_name = "offers.example.com"
route53_zone_id    = "Z1234567890ABC"
```

```bash
terraform init
terraform plan -out tfplan
terraform apply tfplan
```

For GitHub Actions apply and destroy to work reliably, configure a remote Terraform state bucket first. The workflows use an S3 backend and expect the repository secret `TF_STATE_BUCKET` to point to an existing bucket dedicated to Terraform state.

After apply, capture outputs:

```bash
terraform output
```

You will need:

- `csv_input_bucket_name`
- `catalog_site_bucket_name`
- `catalog_cloudfront_domain`
- `catalog_base_url`
- `presign_upload_api_url`

To tear everything down later locally:

```bash
cd tools
npm install
npm run terraform:destroy
```

If the S3 buckets still contain objects, use the force variant:

```bash
cd tools
npm run terraform:destroy:force
```

You can also pass Terraform flags through the helper directly, for example:

```bash
cd tools
node terraform-destroy.mjs --force-buckets --var-file ../infra/terraform.tfvars
```

If you want GitHub Actions to manage the same infrastructure, migrate any existing local state before relying on the workflows:

```bash
cd infra
terraform init -migrate-state \
  -backend-config="bucket=<tf_state_bucket>" \
  -backend-config="key=weekly-offers/dev/terraform.tfstate" \
  -backend-config="region=<aws_region>" \
  -backend-config="encrypt=true" \
  -backend-config="use_lockfile=true"
```

## 2) Upload CSV (Alternative Paths)

Install tooling dependencies once:

```bash
cd tools
npm install
```

Upload a CSV file:

```bash
node upload-csv.mjs ../example.csv <csv_input_bucket_name>
```

Optional custom object key:

```bash
node upload-csv.mjs ../example.csv <csv_input_bucket_name> uploads/my-offers.csv
```

Using presigned upload API:

```bash
curl "<presign_upload_api_url>?fileName=offers.csv"
```

Response example:

```json
{
  "method": "PUT",
  "uploadUrl": "https://...",
  "bucket": "...",
  "key": "uploads/1710000000000-offers.csv",
  "expiresInSeconds": 300
}
```

Then upload directly with the returned URL:

```bash
curl -X PUT -H "Content-Type: text/csv" --upload-file example.csv "<uploadUrl>"
```

The Lambda will process and save:

- `data/processed/<file-name>.json`
- `data/catalog/index.json`

inside `processed_data_bucket_name`.

## 3) Build and Deploy Next.js Catalog

Install and build:

```bash
cd web/catalog
npm install
npm run build
```

Static output will be in `web/catalog/out`.

Upload to the site bucket:

```bash
aws s3 sync out s3://<catalog_site_bucket_name> --delete
```

Open:

```text
https://<catalog_cloudfront_domain>
```

The page reads catalog data from:

- `/data/catalog/index.json`
- `/data/processed/*.json`

through the same CloudFront distribution.

## 4) CI/CD Workflows (GitHub Actions)

Workflows:

- `.github/workflows/terraform-apply.yml`
- `.github/workflows/terraform-destroy.yml`
- `.github/workflows/web-deploy.yml`

Repository variables:

- `AWS_REGION`
- `NEXT_PUBLIC_SITE_URL` (recommended)

Repository secrets:

- `AWS_ROLE_TO_ASSUME`
- `TF_STATE_BUCKET`
- `CATALOG_SITE_BUCKET_NAME`
- `CLOUDFRONT_DISTRIBUTION_ID`
- `PROCESSED_BUCKET_URL`
- `NEXT_PUBLIC_SITE_URL` (optional if set as repository variable)

`AWS_ROLE_TO_ASSUME` should be an IAM role configured for GitHub OIDC with permissions for Terraform resources, the Terraform state bucket, S3 sync, and CloudFront invalidation.

`terraform-destroy.yml` is manual-only and requires `confirm_destroy=DESTROY`. Set `force_destroy_buckets=true` when the CSV, processed-data, or site buckets still contain objects.

## Notes

- This setup uses IAM credentials from your local AWS CLI profile for Terraform, upload script, and deploy sync.
- GitHub Actions Terraform apply and destroy rely on the S3 backend declared in `infra/backend.tf` and configured at runtime from repository settings.
- `.gitignore` is included for Terraform state, Node modules, Next.js build output, and local artifacts.
