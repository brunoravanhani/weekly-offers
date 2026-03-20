output "csv_input_bucket_name" {
  description = "Bucket where CSV files must be uploaded"
  value       = aws_s3_bucket.csv_input.bucket
}

output "processed_data_bucket_name" {
  description = "Bucket where processed JSON and catalog index are saved"
  value       = aws_s3_bucket.processed_data.bucket
}

output "catalog_site_bucket_name" {
  description = "Bucket where Next.js static export should be uploaded"
  value       = aws_s3_bucket.catalog_site.bucket
}

output "catalog_cloudfront_domain" {
  description = "CloudFront URL for catalog and JSON data"
  value       = aws_cloudfront_distribution.catalog.domain_name
}

output "catalog_base_url" {
  description = "Primary public URL of the catalog"
  value       = local.enable_custom_domain ? "https://${var.custom_domain_name}" : "https://${aws_cloudfront_distribution.catalog.domain_name}"
}

output "presign_upload_api_url" {
  description = "Public Lambda Function URL to request presigned CSV upload URLs"
  value       = aws_lambda_function_url.presign_upload.function_url
}
