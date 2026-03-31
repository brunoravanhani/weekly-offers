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

## 1) Features

- Upload CSV with products
- Process CSV file and output it as JSON file
- Merge JSON files imported a week ago
- Host a catalog website with the products imported
- Pipeline to create and detroy infrastructure and deploy website

## 2) Architecture

AWS Services:
  - S3
  - Cloudfront
  - Lambda

![Architecture Diagram](https://github.com/brunoravanhani/weekly-offers/blob/main/architecture.png?raw=true)

## 3) Other files

- [DEPLOY_INFRA.md](https://github.com/brunoravanhani/weekly-offers/blob/main/DEPLOY_INFRA.md)
- [QUICK_SETUP.md](https://github.com/brunoravanhani/weekly-offers/blob/main/QUICK_SETUP.md)


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
- `NEXT_PUBLIC_SITE_URL` (optional if set as repository variable)

`AWS_ROLE_TO_ASSUME` should be an IAM role configured for GitHub OIDC with permissions for Terraform resources, the Terraform state bucket, S3 sync, and CloudFront invalidation.

`terraform-destroy.yml` is manual-only and requires `confirm_destroy=DESTROY`. Set `force_destroy_buckets=true` when the CSV, processed-data, or site buckets still contain objects.

## Notes

- This setup uses IAM credentials from your local AWS CLI profile for Terraform, upload script, and deploy sync.
- GitHub Actions Terraform apply and destroy rely on the S3 backend declared in `infra/backend.tf` and configured at runtime from repository settings.
- `.gitignore` is included for Terraform state, Node modules, Next.js build output, and local artifacts.
