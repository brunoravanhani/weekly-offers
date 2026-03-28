# Quick Setup Notes

## 1) Install dependencies before Terraform apply

Run install in these folders:

- `lambda/csv-to-json`
- `lambda/presign-upload`
- `tools`
- `web/catalog`

Example commands:

```bash
cd lambda/csv-to-json
npm install
cd ../presign-upload
npm install
cd ../../tools
npm install
cd ../web/catalog
npm install
```

## 2) Custom domain configuration (optional)

Set values in `infra/terraform.tfvars`:

```hcl
custom_domain_name = "offers.example.com"
route53_zone_id    = "Z1234567890ABC"
```

## 3) Configure GitHub repository settings

Add these repository secrets:

- `AWS_ROLE_TO_ASSUME`
- `TF_STATE_BUCKET`
- `CATALOG_SITE_BUCKET_NAME`
- `CLOUDFRONT_DISTRIBUTION_ID`
- `PROCESSED_BUCKET_URL`
- `NEXT_PUBLIC_SITE_URL` (optional if set as repository variable)

Add this repository variable:

- `AWS_REGION`
- `NEXT_PUBLIC_SITE_URL` (recommended)

`TF_STATE_BUCKET` must already exist and be writable by the GitHub OIDC role. The Terraform workflows store state at `weekly-offers/<environment>/terraform.tfstate` inside that bucket.

## 4) Destroy infrastructure locally

From `tools`, run:

```bash
npm install
npm run terraform:destroy
```

If Terraform reports that S3 buckets are not empty, rerun with:

```bash
npm run terraform:destroy:force
```

## 5) Destroy infrastructure in GitHub Actions

Run `.github/workflows/terraform-destroy.yml` with:

- `environment`: usually `dev`
- `force_destroy_buckets`: `true` if the S3 buckets are not empty
- `confirm_destroy`: `DESTROY`

If the stack was originally created with local state, migrate that state to the S3 backend first or the workflow will not know what to destroy.
