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
- `CATALOG_SITE_BUCKET_NAME`
- `CLOUDFRONT_DISTRIBUTION_ID`

Add this repository variable:

- `AWS_REGION`
